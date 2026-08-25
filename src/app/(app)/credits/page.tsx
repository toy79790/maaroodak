import type { Metadata } from 'next';
import { Coins, Check, TrendingDown, TrendingUp } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { getSummary, listTransactions } from '@/services/credits/credit-service';
import { prisma } from '@/lib/db/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/states';
import { formatArabicDate } from '@/lib/utils/arabic';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'الرصيد والخطة' };

const REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: 'رصيد ترحيبي',
  PLAN_GRANT: 'منحة خطة',
  ADMIN_ADJUST: 'تعديل إداري',
  GENERATE_LETTER: 'إنشاء معروض',
  AI_TOOL: 'أداة ذكاء اصطناعي',
  REGENERATE: 'إعادة توليد',
  QUALITY_CHECK: 'فحص جودة',
  FOLLOW_UP: 'أسئلة متابعة',
  REFUND: 'استرجاع',
  EXPIRE: 'انتهاء صلاحية',
};

export default async function CreditsPage() {
  const { user } = await requireUser();

  const [summary, transactions, plans] = await Promise.all([
    getSummary(user.id),
    listTransactions(user.id, 30),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        priceMonthly: true,
        lettersPerMonth: true,
        features: true,
        isPopular: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="الرصيد والخطة"
        description="كل معروض أو أداة ذكاء اصطناعي تستهلك رصيداً واحداً."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'الرصيد الحالي', value: summary.balance, icon: Coins },
          { label: 'استُهلك هذا الشهر', value: summary.spentThisMonth, icon: TrendingDown },
          { label: 'أُضيف هذا الشهر', value: summary.grantedThisMonth, icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <stat.icon className="size-4.5" aria-hidden />
              </span>
            </div>
            <p className="tabular mt-3 text-3xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* --- الخطط --- */}
      <h2 className="mb-4 mt-8 font-semibold">الخطط المتاحة</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn('p-5', plan.isPopular && 'border-primary ring-1 ring-primary')}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{plan.name}</h3>
              {plan.isPopular ? <Badge tone="brand">الأكثر اختياراً</Badge> : null}
            </div>

            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="tabular text-2xl font-bold">{plan.priceMonthly}</span>
              <span className="text-xs text-muted-foreground">ريال / شهرياً</span>
            </p>

            <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-center text-sm">
              {plan.lettersPerMonth} معروض شهرياً
            </p>

            <ul className="mt-4 space-y-2">
              {(Array.isArray(plan.features) ? plan.features : []).map((feature) => (
                <li key={String(feature)} className="flex gap-2 text-xs">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="text-muted-foreground">{String(feature)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <p className="mt-4 rounded-[var(--radius-field)] border border-info/30 bg-info-subtle px-4 py-3 text-sm text-info">
        الاشتراكات المدفوعة قيد التجهيز. حسابك يعمل بالكامل على الخطة المجانية.
      </p>

      {/* --- الحركات --- */}
      <h2 className="mb-4 mt-8 font-semibold">سجل الحركات</h2>

      {transactions.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">لا توجد حركات بعد.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  {REASON_LABELS[transaction.reason] ?? transaction.reason}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatArabicDate(transaction.createdAt)}
                </p>
              </div>

              <div className="shrink-0 text-end">
                <p
                  className={cn(
                    'tabular font-semibold',
                    transaction.amount > 0 ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {transaction.amount > 0 ? '+' : ''}
                  {transaction.amount}
                </p>
                <p className="tabular text-xs text-subtle-foreground">
                  الرصيد: {transaction.balanceAfter}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
