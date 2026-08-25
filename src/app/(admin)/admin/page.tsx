import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  Files,
  Building2,
  MessageSquareQuote,
  TrendingDown,
  ThumbsUp,
  DollarSign,
  Activity,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth/guards';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/states';
import {
  getAdminOverview,
  getAiCostReport,
  getFunnel,
  getLettersByDepartment,
  getLettersByRequestType,
} from '@/features/admin/queries';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'لوحة الإدارة' };

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-lg',
            tone === 'good'
              ? 'bg-success-subtle text-success'
              : tone === 'warn'
                ? 'bg-warning-subtle text-warning'
                : 'bg-primary-subtle text-primary',
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-3 text-3xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function BarList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: ReadonlyArray<{ id: string; name: string; count: number }>;
  emptyText: string;
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

export default async function AdminDashboardPage() {
  await requireAdmin();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [overview, byDepartment, byRequestType, funnel, cost] = await Promise.all([
    getAdminOverview(),
    getLettersByDepartment(6),
    getLettersByRequestType(6),
    getFunnel(since),
    getAiCostReport(since),
  ]);

  return (
    <>
      <PageHeader
        title="لوحة الإدارة"
        description="نظرة عامة على المنصة — آخر 30 يوماً للتكلفة والقمع."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="المستخدمون"
          value={overview.users.total}
          hint={`${overview.users.newThisMonth} جديد هذا الشهر`}
          icon={Users}
        />
        <StatCard
          label="المعاريض"
          value={overview.letters.total}
          hint={`${overview.letters.thisMonth} هذا الشهر`}
          icon={Files}
        />
        <StatCard
          label="معدل إكمال المقابلة"
          value={percent(overview.interviews.completionRate)}
          hint={`${overview.interviews.abandoned} مقابلة مهجورة`}
          icon={TrendingDown}
          tone={overview.interviews.completionRate >= 0.7 ? 'good' : 'warn'}
        />
        <StatCard
          label="رضا المستخدمين"
          value={
            overview.feedback.up + overview.feedback.down === 0
              ? '—'
              : percent(overview.feedback.satisfaction)
          }
          hint={`👍 ${overview.feedback.up} · 👎 ${overview.feedback.down}`}
          icon={ThumbsUp}
          tone={overview.feedback.satisfaction >= 0.8 ? 'good' : 'neutral'}
        />
      </div>

      {/* --- تكلفة الذكاء الاصطناعي --- */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="size-4.5 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">تكلفة الذكاء الاصطناعي (30 يوماً)</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            {
              label: 'التكلفة الإجمالية',
              value: `$${cost.totalCostUsd.toFixed(2)}`,
            },
            {
              label: 'التكلفة لكل معروض',
              value: `$${cost.costPerLetterUsd.toFixed(4)}`,
            },
            { label: 'عدد النداءات', value: String(cost.totalCalls) },
            {
              label: 'معدل الفشل',
              value: percent(cost.failureRate),
            },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="tabular mt-1 text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>

        {cost.byModel.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {cost.byModel.map((row) => (
              <li key={row.model}>
                <Badge tone="neutral" className="tabular">
                  {row.model}: ${row.costUsd.toFixed(2)} ({row.calls})
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* --- القمع --- */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="size-4.5 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">قمع التحويل (30 يوماً)</h2>
        </div>

        <ol className="space-y-3">
          {funnel.map((step, index) => (
            <li key={step.name} className="flex items-center gap-3">
              <span className="tabular w-6 shrink-0 text-xs text-subtle-foreground">
                {index + 1}
              </span>
              <span className="w-32 shrink-0 truncate text-sm">{step.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
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
              {index > 0 ? (
                <span
                  className={cn(
                    'tabular w-12 shrink-0 text-end text-xs',
                    step.conversionRate < 0.5 ? 'text-danger' : 'text-muted-foreground',
                  )}
                >
                  {percent(step.conversionRate)}
                </span>
              ) : (
                <span className="w-12 shrink-0" />
              )}
            </li>
          ))}
        </ol>
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

      {/* --- الكتالوج --- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            href: '/admin/departments',
            label: 'الجهات',
            value: overview.catalog.departments,
            icon: Building2,
          },
          {
            href: '/admin/request-types',
            label: 'أنواع الطلبات',
            value: overview.catalog.requestTypes,
            icon: Files,
          },
          {
            href: '/admin/questions',
            label: 'الأسئلة',
            value: overview.catalog.questions,
            icon: MessageSquareQuote,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors hover:border-primary"
          >
            <span className="inline-flex size-11 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <item.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="tabular block text-2xl font-bold">{item.value}</span>
              <span className="block text-sm text-muted-foreground">{item.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
