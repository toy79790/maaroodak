import 'server-only';

import type { AIOperation, AIStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import type { LLMUsage } from '@/services/ai/ports';

/**
 * تتبّع تكلفة الذكاء الاصطناعي — docs/AI_SYSTEM.md §11
 *
 * ⚠️ لا تُخزَّن نصوص: لا Prompt ولا مخرَج. عدّادات فقط (docs/SECURITY.md §11).
 *
 * الأسعار لكل مليون رمز. قراءات التخزين المؤقت تُحتسب بـ 0.1× من سعر
 * الإدخال — وهي أهم مصدر وفر في هذا المنتج لأن طبقات L1..L4 ثابتة.
 */

interface ModelPricing {
  input: number;
  output: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** سعر افتراضي محافظ لنموذج غير معروف — أفضل من تسجيل صفر. */
const FALLBACK_PRICING: ModelPricing = { input: 5, output: 25 };

const CACHE_READ_MULTIPLIER = 0.1;

export function priceFor(model: string): ModelPricing {
  // معرّفات النماذج قد تحمل لاحقة تاريخ في بعض المنصات.
  const exact = PRICING[model];
  if (exact) return exact;

  for (const [key, pricing] of Object.entries(PRICING)) {
    if (model.startsWith(key)) return pricing;
  }

  return FALLBACK_PRICING;
}

export function computeCostUsd(usage: LLMUsage): number {
  const pricing = priceFor(usage.model);

  const billedInput = Math.max(usage.inputTokens - usage.cachedTokens, 0);

  const cost =
    (billedInput / 1_000_000) * pricing.input +
    (usage.cachedTokens / 1_000_000) * pricing.input * CACHE_READ_MULTIPLIER +
    (usage.outputTokens / 1_000_000) * pricing.output;

  // 6 خانات عشرية — يطابق Decimal(12,6) في المخطط.
  return Number(cost.toFixed(6));
}

export interface RecordUsageInput {
  operation: AIOperation;
  usage: LLMUsage;
  status?: AIStatus;
  errorCode?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  letterId?: string | null;
}

/**
 * تسجيل استخدام واحد.
 *
 * لا يرمي أبداً: فشل التسجيل يجب ألّا يُفشل عملية المستخدم. لكنه يُسجَّل
 * في سجل الخادم لأن فقدان سجل تكلفة مشكلة محاسبية حقيقية.
 */
export async function recordUsage(
  input: RecordUsageInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  try {
    await tx.aIUsage.create({
      data: {
        operation: input.operation,
        provider: 'anthropic',
        model: input.usage.model,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cachedTokens: input.usage.cachedTokens,
        costUsd: computeCostUsd(input.usage),
        latencyMs: input.usage.latencyMs,
        status: input.status ?? 'SUCCESS',
        errorCode: input.errorCode ?? null,
        userId: input.userId ?? null,
        organizationId: input.organizationId ?? null,
        letterId: input.letterId ?? null,
      },
    });
  } catch (error) {
    console.error('[ai-usage] تعذّر تسجيل الاستخدام', error);
  }
}

/** تسجيل عدة استخدامات (توليد + إعادة توليد + فحص جودة في عملية واحدة). */
export async function recordUsages(
  usages: readonly LLMUsage[],
  common: Omit<RecordUsageInput, 'usage'>,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  for (const usage of usages) {
    await recordUsage({ ...common, usage }, tx);
  }
}

/**
 * تسجيل فشل بلا استخدام فعلي (مهلة، رفض قبل التوليد).
 * نُسجّل الصفر عمداً: معدل الفشل مقياس مهم بذاته.
 */
export async function recordFailure(input: {
  operation: AIOperation;
  model: string;
  status: AIStatus;
  errorCode: string;
  latencyMs?: number;
  userId?: string | null;
  organizationId?: string | null;
  letterId?: string | null;
}): Promise<void> {
  await recordUsage({
    operation: input.operation,
    status: input.status,
    errorCode: input.errorCode,
    userId: input.userId,
    organizationId: input.organizationId,
    letterId: input.letterId,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      model: input.model,
      latencyMs: input.latencyMs ?? 0,
    },
  });
}

// ---------------------------------------------------------------------------
// التقارير الإدارية
// ---------------------------------------------------------------------------

export interface UsageSummary {
  totalCostUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  failureRate: number;
  averageLatencyMs: number;
}

export async function getUsageSummary(since: Date): Promise<UsageSummary> {
  const [aggregate, failures] = await Promise.all([
    prisma.aIUsage.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _avg: { latencyMs: true },
      _count: true,
    }),
    prisma.aIUsage.count({
      where: { createdAt: { gte: since }, status: { not: 'SUCCESS' } },
    }),
  ]);

  const totalCalls = aggregate._count;

  return {
    totalCostUsd: Number(aggregate._sum.costUsd ?? 0),
    totalCalls,
    totalInputTokens: aggregate._sum.inputTokens ?? 0,
    totalOutputTokens: aggregate._sum.outputTokens ?? 0,
    failureRate: totalCalls === 0 ? 0 : failures / totalCalls,
    averageLatencyMs: Math.round(aggregate._avg.latencyMs ?? 0),
  };
}

export async function getCostByModel(since: Date) {
  const grouped = await prisma.aIUsage.groupBy({
    by: ['model'],
    where: { createdAt: { gte: since } },
    _sum: { costUsd: true },
    _count: true,
  });

  return grouped
    .map((row) => ({
      model: row.model,
      costUsd: Number(row._sum.costUsd ?? 0),
      calls: row._count,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

export async function getCostByOperation(since: Date) {
  const grouped = await prisma.aIUsage.groupBy({
    by: ['operation'],
    where: { createdAt: { gte: since } },
    _sum: { costUsd: true },
    _count: true,
  });

  return grouped
    .map((row) => ({
      operation: row.operation,
      costUsd: Number(row._sum.costUsd ?? 0),
      calls: row._count,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
}
