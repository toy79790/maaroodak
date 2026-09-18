import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type {
  ConditionRule,
  ConditionClause,
  QuestionDef,
  QuestionTypeName,
  QuestionValidation,
} from '@/types/questions';

/**
 * الوصول للكتالوج — الجهات وأنواع الطلبات والأسئلة.
 *
 * كل الدوال تستقبل `organizationId` وتُرجع سجلات النظام (`null`) بالإضافة
 * إلى سجلات المنظمة — انظر docs/ARCHITECTURE.md §8.
 * لا يُستدعى `prisma` مباشرة خارج مجلد repositories.
 */

export interface TenantScope {
  organizationId: string | null;
}

/**
 * سجلات النظام (`organizationId = null`) + سجلات المنظمة الحالية.
 *
 * تُبنى كـ `OR` لا كـ `in: [null, id]`: مرشّح `in` في Prisma لا يقبل `null`
 * (و SQL كذلك — `IN (NULL)` لا يطابق شيئاً). يُدمج دائماً داخل `AND`
 * حتى لا يصطدم بأي `OR` آخر في نفس الاستعلام.
 */
function tenantFilter(scope: TenantScope): { OR: Array<{ organizationId: string | null }> } {
  return {
    OR: [
      { organizationId: null },
      ...(scope.organizationId ? [{ organizationId: scope.organizationId }] : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// الجهات
// ---------------------------------------------------------------------------

export interface DepartmentSummary {
  id: string;
  slug: string;
  name: string;
  /** اسم الفئة للعرض — الفئات تُدار من اللوحة (#D-036). */
  category: string;
  /** ترتيب الفئة — يرتّب مجموعات العرض لا الجهات داخلها. */
  categoryOrder: number;
  description: string | null;
  addressee: string | null;
  honorific: string | null;
  requestTypeCount: number;
}

export async function listDepartments(
  scope: TenantScope,
): Promise<DepartmentSummary[]> {
  const departments = await prisma.department.findMany({
    // الفئة المعطّلة تُخفي جهاتها عن المستخدمين دون أن تمسّ الجهات نفسها.
    where: {
      AND: [tenantFilter(scope)],
      isActive: true,
      deletedAt: null,
      category: { isActive: true },
    },
    orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      category: { select: { name: true, order: true } },
      description: true,
      addressee: true,
      honorific: true,
      _count: { select: { requestTypes: { where: { isActive: true } } } },
    },
  });

  return departments.map((department) => ({
    id: department.id,
    slug: department.slug,
    name: department.name,
    category: department.category.name,
    categoryOrder: department.category.order,
    description: department.description,
    addressee: department.addressee,
    honorific: department.honorific,
    requestTypeCount: department._count.requestTypes,
  }));
}

export async function getDepartment(scope: TenantScope, id: string) {
  return prisma.department.findFirst({
    where: { id, AND: [tenantFilter(scope)], isActive: true, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      category: { select: { name: true } },
      description: true,
      addressee: true,
      honorific: true,
    },
  });
}

// ---------------------------------------------------------------------------
// أنواع الطلبات
// ---------------------------------------------------------------------------

export interface RequestTypeSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
}

/** أنواع الطلبات المتاحة لجهة بعينها — أساس «تختلف الخيارات حسب الجهة». */
export async function listRequestTypesForDepartment(
  scope: TenantScope,
  departmentId: string,
): Promise<RequestTypeSummary[]> {
  const links = await prisma.departmentRequestType.findMany({
    where: {
      departmentId,
      isActive: true,
      requestType: { isActive: true, deletedAt: null, AND: [tenantFilter(scope)] },
    },
    orderBy: [{ order: 'asc' }],
    select: {
      requestType: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          icon: true,
        },
      },
    },
  });

  return links.map((link) => link.requestType);
}

export async function getRequestType(scope: TenantScope, id: string) {
  return prisma.requestType.findFirst({
    where: { id, AND: [tenantFilter(scope)], isActive: true, deletedAt: null },
    select: { id: true, slug: true, name: true, description: true },
  });
}

/** يتحقق أن نوع الطلب متاح فعلاً لهذه الجهة — لا نثق بما يرسله العميل. */
export async function isRequestTypeAllowed(
  departmentId: string,
  requestTypeId: string,
): Promise<boolean> {
  const link = await prisma.departmentRequestType.findUnique({
    where: { departmentId_requestTypeId: { departmentId, requestTypeId } },
    select: { isActive: true },
  });
  return link?.isActive ?? false;
}

// ---------------------------------------------------------------------------
// الأسئلة
// ---------------------------------------------------------------------------

/**
 * خصوصية النطاق — الأعلى يفوز عند تكرار المفتاح (engine.dedupeByScope).
 *   0 = عام · 1 = حسب الجهة · 2 = حسب نوع الطلب · 3 = الثنائية
 *
 * لماذا نوع الطلب أخصّ من الجهة؟ لأن ما يجعل «طلب مساعدة مالية» مقنعاً
 * ثابت عبر الجهات، بينما الجهة تُغيّر النبرة لا المضمون.
 */
function scopeSpecificity(
  departmentId: string | null,
  requestTypeId: string | null,
): number {
  if (departmentId && requestTypeId) return 3;
  if (requestTypeId) return 2;
  if (departmentId) return 1;
  return 0;
}

function parseValidation(value: unknown): QuestionValidation | null {
  if (!value || typeof value !== 'object') return null;
  return value as QuestionValidation;
}

function parseClauses(value: unknown): ConditionClause[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (clause): clause is ConditionClause =>
      typeof clause === 'object' &&
      clause !== null &&
      typeof (clause as ConditionClause).sourceQuestionKey === 'string' &&
      typeof (clause as ConditionClause).operator === 'string',
  );
}

export interface QuestionBundle {
  questions: QuestionDef[];
  conditions: ConditionRule[];
}

/**
 * يجمع كل أسئلة النطاق الأربعة لثنائية (جهة، نوع طلب) مع شروطها.
 *
 * استعلام واحد للأسئلة واستعلام واحد للشروط — لا N+1.
 */
export async function loadQuestionBundle(
  scope: TenantScope,
  departmentId: string,
  requestTypeId: string,
): Promise<QuestionBundle> {
  const rows = await prisma.question.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      AND: [
        tenantFilter(scope),
        {
          // النطاقات الأربعة — انظر docs/DATABASE.md §3
          OR: [
            { departmentId: null, requestTypeId: null },
            { departmentId: null, requestTypeId },
            { departmentId, requestTypeId: null },
            { departmentId, requestTypeId },
          ],
        },
      ],
    },
    orderBy: [{ order: 'asc' }],
    select: {
      id: true,
      key: true,
      label: true,
      description: true,
      type: true,
      required: true,
      placeholder: true,
      helpText: true,
      groupKey: true,
      order: true,
      aiHint: true,
      validation: true,
      departmentId: true,
      requestTypeId: true,
      options: {
        orderBy: { order: 'asc' },
        select: { value: true, label: true, order: true },
      },
    },
  });

  const questions: QuestionDef[] = rows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    type: row.type as QuestionTypeName,
    required: row.required,
    placeholder: row.placeholder,
    helpText: row.helpText,
    groupKey: row.groupKey,
    order: row.order,
    aiHint: row.aiHint,
    options: row.options,
    validation: parseValidation(row.validation),
    scopeSpecificity: scopeSpecificity(row.departmentId, row.requestTypeId),
  }));

  const conditionRows = await prisma.questionCondition.findMany({
    where: {
      isActive: true,
      targetQuestionId: { in: questions.map((question) => question.id) },
    },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      targetQuestionId: true,
      action: true,
      logic: true,
      clauses: true,
      order: true,
    },
  });

  const keyById = new Map(questions.map((question) => [question.id, question.key]));

  const conditions: ConditionRule[] = conditionRows.flatMap((row) => {
    const targetQuestionKey = keyById.get(row.targetQuestionId);
    if (!targetQuestionKey) return [];

    const clauses = parseClauses(row.clauses);
    if (clauses.length === 0) return [];

    return [
      {
        id: row.id,
        targetQuestionKey,
        action: row.action,
        logic: row.logic,
        clauses,
        order: row.order,
      },
    ];
  });

  return { questions, conditions };
}

// ---------------------------------------------------------------------------
// الكتالوج العام — صفحتا /departments و /request-types (بلا تسجيل دخول)
// ---------------------------------------------------------------------------

/**
 * سجلات النظام وحدها (`organizationId = null`): الزائر بلا منظمة، وكتالوج
 * منظمة بعينها ليس للعرض العام. وبنفس شروط الظهور للمستخدم المسجّل: جهة
 * مفعّلة غير محذوفة، وفئة مفعّلة.
 */
export interface PublicCategory {
  slug: string;
  name: string;
  description: string | null;
  departments: Array<{
    slug: string;
    name: string;
    description: string | null;
    requestTypes: string[];
  }>;
}

export async function listPublicDepartments(): Promise<PublicCategory[]> {
  const categories = await prisma.departmentCategory.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      description: true,
      departments: {
        where: { organizationId: null, isActive: true, deletedAt: null },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        select: {
          slug: true,
          name: true,
          description: true,
          requestTypes: {
            where: { isActive: true, requestType: { isActive: true, deletedAt: null } },
            orderBy: { order: 'asc' },
            select: { requestType: { select: { name: true } } },
          },
        },
      },
    },
  });

  return categories
    .filter((category) => category.departments.length > 0)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      description: category.description,
      departments: category.departments.map((department) => ({
        slug: department.slug,
        name: department.name,
        description: department.description,
        requestTypes: department.requestTypes.map((link) => link.requestType.name),
      })),
    }));
}

export interface PublicRequestType {
  slug: string;
  name: string;
  description: string | null;
  departmentCount: number;
}

/** أنواع الطلبات المرتبطة بجهة واحدة ظاهرة على الأقل — النوع اليتيم لا يُعرض. */
export async function listPublicRequestTypes(): Promise<PublicRequestType[]> {
  const types = await prisma.requestType.findMany({
    where: { organizationId: null, isActive: true, deletedAt: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      description: true,
      departments: {
        where: {
          isActive: true,
          department: {
            organizationId: null,
            isActive: true,
            deletedAt: null,
            category: { isActive: true },
          },
        },
        select: { id: true },
      },
    },
  });

  return types
    .filter((type) => type.departments.length > 0)
    .map((type) => ({
      slug: type.slug,
      name: type.name,
      description: type.description,
      departmentCount: type.departments.length,
    }));
}
