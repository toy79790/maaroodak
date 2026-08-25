import 'server-only';

import { prisma } from '@/lib/db/prisma';

/**
 * تتبّع أحداث القمع — docs/PROJECT_PLAN.md §1.4
 *
 * مبدأ حاكم: **التحليلات لا تُفشل عملية المستخدم أبداً.** أي خطأ هنا يُبتلع
 * ويُسجَّل. فقدان حدث قياس مقبول؛ فقدان معروض المستخدم ليس كذلك.
 *
 * لا تُخزَّن أي بيانات شخصية في `props` — معرّفات وشرائح فقط.
 */

export const ANALYTICS_EVENTS = [
  'interview_started',
  'question_answered',
  'interview_abandoned',
  'interview_completed',
  'letter_generated',
  'letter_regenerated',
  'letter_edited',
  'letter_exported',
  'ai_tool_used',
  'follow_up_requested',
  'feedback_submitted',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export interface EventContext {
  userId?: string | null;
  anonymousId?: string | null;
  props?: Record<string, unknown>;
}

export async function recordEvent(
  name: AnalyticsEventName,
  context: EventContext = {},
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        userId: context.userId ?? null,
        anonymousId: context.anonymousId ?? null,
        props: (context.props ?? {}) as never,
      },
    });
  } catch (error) {
    console.error(`[analytics] تعذّر تسجيل الحدث "${name}"`, error);
  }
}

// ---------------------------------------------------------------------------
// التقارير
// ---------------------------------------------------------------------------

export interface FunnelStep {
  name: string;
  label: string;
  count: number;
  /** نسبة التحويل من الخطوة السابقة. */
  conversionRate: number;
}

const FUNNEL_DEFINITION: ReadonlyArray<{
  name: AnalyticsEventName;
  label: string;
}> = [
  { name: 'interview_started', label: 'بدأ المقابلة' },
  { name: 'interview_completed', label: 'أكمل الأسئلة' },
  { name: 'letter_generated', label: 'ولّد المعروض' },
  { name: 'letter_exported', label: 'حمّل الملف' },
];

export async function getFunnel(since: Date): Promise<FunnelStep[]> {
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: {
      createdAt: { gte: since },
      name: { in: FUNNEL_DEFINITION.map((step) => step.name) },
    },
    _count: { name: true },
  });

  const counts = new Map(grouped.map((row) => [row.name, row._count.name]));

  const steps: FunnelStep[] = [];
  let previousCount = 0;

  for (const [index, step] of FUNNEL_DEFINITION.entries()) {
    const count = counts.get(step.name) ?? 0;

    const conversionRate =
      index === 0 ? 1 : previousCount === 0 ? 0 : Math.min(count / previousCount, 1);

    steps.push({ name: step.name, label: step.label, count, conversionRate });
    previousCount = count;
  }

  return steps;
}

/**
 * معدّل التخلّي لكل خطوة — يكشف «الأسئلة القاتلة».
 * أهم تقرير في المنتج: سؤال واحد سيئ الصياغة قد يُسقط نصف المستخدمين.
 */
export async function getDropOffByStep(
  since: Date,
): Promise<Array<{ step: number; reached: number }>> {
  const events = await prisma.analyticsEvent.findMany({
    where: { name: 'question_answered', createdAt: { gte: since } },
    select: { props: true },
  });

  const byStep = new Map<number, number>();

  for (const event of events) {
    const props = event.props as { step?: unknown } | null;
    const step = typeof props?.step === 'number' ? props.step : null;
    if (step === null) continue;
    byStep.set(step, (byStep.get(step) ?? 0) + 1);
  }

  return [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, reached]) => ({ step, reached }));
}
