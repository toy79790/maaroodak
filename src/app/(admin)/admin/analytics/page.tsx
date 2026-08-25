import type { Metadata } from 'next';
import { Activity, DollarSign, TrendingDown, ThumbsUp } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getAdminOverview,
  getAiCostReport,
  getFunnel,
  getLettersByDepartment,
  getLettersByRequestType,
} from '@/features/admin/queries';
import { getDropOffByStep } from '@/services/analytics/analytics-service';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'الإحصائيات' };

const percent = (value: number) => `${Math.round(value * 100)}%`;

function BarList({
  title,
  items,
  emptyText,
  suffix,
}: {
  title: string;
  items: ReadonlyArray<{ id: string; name: string; count: number }>;
  emptyText: string;
  suffix?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {item.count}
                  {suffix ? ` ${suffix}` : ''}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function AdminAnalyticsPage() {
  await requirePermission('analytics:read');

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [overview, funnel, cost, byDepartment, byRequestType, dropOff, topQuestions] =
    await Promise.all([
      getAdminOverview(),
      getFunnel(since),
      getAiCostReport(since),
      getLettersByDepartment(10),
      getLettersByRequestType(10),
      getDropOffByStep(since),
      prisma.feedback.groupBy({
        by: ['rating'],
        _count: { rating: true },
      }),
    ]);

  const maxReached = Math.max(...dropOff.map((step) => step.reached), 1);

  return (
    <>
      <PageHeader
        title="الإحصائيات"
        description="آخر 30 يوماً. المقياس الأهم: معدل إكمال المقابلة وتكلفة المعروض الواحد."
      />

      {/* --- المؤشرات --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'معدل إكمال المقابلة',
            value: percent(overview.interviews.completionRate),
            hint: `${overview.interviews.abandoned} مهجورة من ${overview.interviews.started}`,
            icon: TrendingDown,
            good: overview.interviews.completionRate >= 0.7,
          },
          {
            label: 'التكلفة لكل معروض',
            value: `$${cost.costPerLetterUsd.toFixed(4)}`,
            hint: `${cost.letterCount} معروض · $${cost.totalCostUsd.toFixed(2)} إجمالاً`,
            icon: DollarSign,
            good: true,
          },
          {
            label: 'رضا المستخدمين',
            value:
              overview.feedback.up + overview.feedback.down === 0
                ? '—'
                : percent(overview.feedback.satisfaction),
            hint: `👍 ${overview.feedback.up} · 👎 ${overview.feedback.down}`,
            icon: ThumbsUp,
            good: overview.feedback.satisfaction >= 0.8,
          },
          {
            label: 'معدل فشل الذكاء الاصطناعي',
            value: percent(cost.failureRate),
            hint: `${cost.totalCalls} نداء · ${cost.averageLatencyMs}مث متوسط`,
            icon: Activity,
            good: cost.failureRate < 0.05,
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-lg',
                  stat.good
                    ? 'bg-success-subtle text-success'
                    : 'bg-warning-subtle text-warning',
                )}
              >
                <stat.icon className="size-4.5" aria-hidden />
              </span>
            </div>
            <p className="tabular mt-3 text-2xl font-bold">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </Card>
        ))}
      </div>

      {/* --- القمع --- */}
      <Card className="mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold">قمع التحويل</h2>

        <ol className="space-y-3">
          {funnel.map((step, index) => (
            <li key={step.name} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm">{step.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${(step.count / Math.max(funnel[0]?.count ?? 1, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="tabular w-12 shrink-0 text-end text-sm">
                {step.count}
              </span>
              <span
                className={cn(
                  'tabular w-12 shrink-0 text-end text-xs',
                  index > 0 && step.conversionRate < 0.5
                    ? 'text-danger'
                    : 'text-muted-foreground',
                )}
              >
                {index === 0 ? '' : percent(step.conversionRate)}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* --- التخلي عن الأسئلة --- */}
      <Card className="mt-6 p-5">
        <h2 className="mb-1 text-sm font-semibold">التخلّي حسب الخطوة</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          الهبوط الحاد بين خطوتين يكشف «سؤالاً قاتلاً» — صياغة مربكة أو معلومة
          يتردّد المستخدم في ذكرها.
        </p>

        {dropOff.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات كافية بعد.</p>
        ) : (
          <ol className="flex items-end gap-1.5" aria-label="عدد الإجابات لكل خطوة">
            {dropOff.map((step) => (
              <li key={step.step} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="tabular text-xs text-muted-foreground">
                  {step.reached}
                </span>
                <div
                  className="w-full rounded-t bg-primary"
                  style={{ height: `${Math.max((step.reached / maxReached) * 120, 4)}px` }}
                />
                <span className="tabular text-xs text-subtle-foreground">
                  {step.step + 1}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* --- التوزيع --- */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <BarList
          title="المعاريض حسب الجهة"
          items={byDepartment}
          emptyText="لا توجد معاريض بعد."
        />
        <BarList
          title="المعاريض حسب نوع الطلب"
          items={byRequestType}
          emptyText="لا توجد معاريض بعد."
        />
      </div>

      {/* --- تكلفة الذكاء الاصطناعي --- */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">التكلفة حسب النموذج</h2>
          {cost.byModel.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد نداءات بعد.</p>
          ) : (
            <ul className="space-y-2.5">
              {cost.byModel.map((row) => (
                <li key={row.model} className="flex items-center justify-between gap-3">
                  <code className="min-w-0 truncate text-xs" dir="ltr">
                    {row.model}
                  </code>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral" className="tabular">
                      {row.calls} نداء
                    </Badge>
                    <span className="tabular text-sm font-medium">
                      ${row.costUsd.toFixed(3)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">التكلفة حسب العملية</h2>
          {cost.byOperation.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد نداءات بعد.</p>
          ) : (
            <ul className="space-y-2.5">
              {cost.byOperation.map((row) => (
                <li
                  key={row.operation}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-sm">{row.operation}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral" className="tabular">
                      {row.calls}
                    </Badge>
                    <span className="tabular text-sm font-medium">
                      ${row.costUsd.toFixed(3)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-4 text-xs text-subtle-foreground">
        إجمالي التقييمات: {topQuestions.reduce((sum, row) => sum + row._count.rating, 0)}
      </p>
    </>
  );
}
