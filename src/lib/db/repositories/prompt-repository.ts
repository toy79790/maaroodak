import 'server-only';

import type { PromptType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { TenantScope } from '@/lib/db/repositories/catalog-repository';

/**
 * اختيار القوالب والموجّهات بأولوية الأخص:
 *   (جهة + نوع) → (نوع) → (جهة) → الافتراضي
 *
 * هذه القاعدة هي ما يجعل المخرجات مختلفة لكل حالة بدل نموذج واحد ثابت.
 */

function tenantOr(scope: TenantScope) {
  return [
    { organizationId: null },
    ...(scope.organizationId ? [{ organizationId: scope.organizationId }] : []),
  ];
}

/**
 * درجة المطابقة — الأعلى يفوز.
 * سجل المنظمة يتقدّم على سجل النظام بنفس الخصوصية (+8).
 */
function score(
  record: { departmentId: string | null; requestTypeId: string | null; organizationId: string | null },
  departmentId: string,
  requestTypeId: string,
): number {
  const matchesDepartment = record.departmentId === departmentId;
  const matchesType = record.requestTypeId === requestTypeId;

  if (record.departmentId && !matchesDepartment) return -1;
  if (record.requestTypeId && !matchesType) return -1;

  let value = 0;
  if (matchesDepartment && matchesType) value = 4;
  else if (matchesType) value = 3;
  else if (matchesDepartment) value = 2;
  else value = 1;

  return record.organizationId ? value + 8 : value;
}

function pickBest<
  T extends {
    departmentId: string | null;
    requestTypeId: string | null;
    organizationId: string | null;
  },
>(records: readonly T[], departmentId: string, requestTypeId: string): T | null {
  let best: T | null = null;
  let bestScore = 0;

  for (const record of records) {
    const value = score(record, departmentId, requestTypeId);
    if (value > bestScore) {
      best = record;
      bestScore = value;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// القوالب
// ---------------------------------------------------------------------------

export interface ResolvedTemplate {
  id: string;
  slug: string;
  name: string;
  body: string;
}

export async function resolveTemplate(
  scope: TenantScope,
  departmentId: string,
  requestTypeId: string,
): Promise<ResolvedTemplate | null> {
  // 1) تجاوز صريح على مستوى الثنائية — أعلى أولوية على الإطلاق.
  const link = await prisma.departmentRequestType.findUnique({
    where: { departmentId_requestTypeId: { departmentId, requestTypeId } },
    select: {
      template: {
        select: { id: true, slug: true, name: true, body: true, isActive: true },
      },
    },
  });

  if (link?.template?.isActive) {
    const { isActive: _isActive, ...template } = link.template;
    return template;
  }

  const candidates = await prisma.template.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      AND: [{ OR: tenantOr(scope) }],
      OR: [
        { departmentId, requestTypeId },
        { departmentId, requestTypeId: null },
        { departmentId: null, requestTypeId },
        { departmentId: null, requestTypeId: null },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      body: true,
      departmentId: true,
      requestTypeId: true,
      organizationId: true,
      isDefault: true,
    },
  });

  const best = pickBest(candidates, departmentId, requestTypeId);
  if (best) {
    return { id: best.id, slug: best.slug, name: best.name, body: best.body };
  }

  // 2) الاحتياط الأخير: القالب الافتراضي المُعلَّم.
  const fallback = await prisma.template.findFirst({
    where: { isDefault: true, isActive: true, deletedAt: null, organizationId: null },
    select: { id: true, slug: true, name: true, body: true },
  });

  return fallback;
}

// ---------------------------------------------------------------------------
// الموجّهات
// ---------------------------------------------------------------------------

export interface ResolvedPrompt {
  id: string;
  key: string;
  content: string;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
}

export async function resolvePrompt(
  scope: TenantScope,
  type: PromptType,
  departmentId?: string | null,
  requestTypeId?: string | null,
): Promise<ResolvedPrompt | null> {
  const candidates = await prisma.prompt.findMany({
    where: {
      type,
      isActive: true,
      deletedAt: null,
      AND: [{ OR: tenantOr(scope) }],
    },
    select: {
      id: true,
      key: true,
      content: true,
      model: true,
      temperature: true,
      maxTokens: true,
      departmentId: true,
      requestTypeId: true,
      organizationId: true,
    },
  });

  if (!departmentId || !requestTypeId) {
    // موجّه غير مرتبط بسياق (الأسلوب، الأدوات) — نأخذ العام.
    const global = candidates.find(
      (candidate) => !candidate.departmentId && !candidate.requestTypeId,
    );
    return global ?? candidates[0] ?? null;
  }

  return pickBest(candidates, departmentId, requestTypeId);
}

/**
 * موجّهات جهة ونوع الطلب معاً — طبقتا L3 و L4.
 *
 * لا نأخذ «الأفضل» واحداً هنا: الطبقتان **تتراكمان** لا تتنافسان. سياق
 * الجهة يحدّد النبرة، وسياق النوع يحدّد زاوية الإقناع، وكلاهما مطلوب.
 */
export async function resolveGenerationLayers(
  scope: TenantScope,
  departmentId: string,
  requestTypeId: string,
): Promise<{ department: string | null; requestType: string | null }> {
  const candidates = await prisma.prompt.findMany({
    where: {
      type: 'GENERATION',
      isActive: true,
      deletedAt: null,
      AND: [{ OR: tenantOr(scope) }],
      OR: [{ departmentId }, { requestTypeId }],
    },
    select: {
      content: true,
      departmentId: true,
      requestTypeId: true,
      organizationId: true,
    },
  });

  const departmentPrompts = candidates.filter(
    (candidate) => candidate.departmentId === departmentId && !candidate.requestTypeId,
  );
  const typePrompts = candidates.filter(
    (candidate) => candidate.requestTypeId === requestTypeId && !candidate.departmentId,
  );

  // سجل المنظمة يتقدّم على سجل النظام.
  const preferOrg = <T extends { organizationId: string | null }>(items: T[]) =>
    items.find((item) => item.organizationId !== null) ?? items[0] ?? null;

  return {
    department: preferOrg(departmentPrompts)?.content ?? null,
    requestType: preferOrg(typePrompts)?.content ?? null,
  };
}

export async function getSystemStyle(scope: TenantScope): Promise<string> {
  const prompt = await resolvePrompt(scope, 'SYSTEM');
  return prompt?.content ?? '';
}
