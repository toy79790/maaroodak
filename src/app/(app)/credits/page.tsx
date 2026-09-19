import type { Metadata } from 'next';
import Link from 'next/link';
import { Coins, Check, Mail, TrendingDown, TrendingUp } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { getSummary, listTransactions } from '@/services/credits/credit-service';
import { PRICE_PER_LETTER_SAR } from '@/config/constants';
import { site } from '@/config/site';
import { LETTER_PRICE_FEATURES } from '@/features/marketing/content';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/states';
import { formatArabicDate } from '@/lib/utils/arabic';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = { title: 'الرصيد' };

const REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: 'رصيد ترحيبي',
  PLAN_GRANT: 'منحة خطة',
  ADMIN_ADJUST: 'شراء رصيد / تعديل إداري',
  AI_TOOL: 'تحسين بالذكاء الاصطناعي (مشمول)',
  GENERATE_LETTER: 'إنشاء معروض',
  REGENERATE: 'إعادة توليد',
  QUALITY_CHECK: 'فحص جودة',
  FOLLOW_UP: 'أسئلة متابعة',
  REFUND: 'استرجاع',
  EXPIRE: 'انتهاء صلاحية',
};

export default async function CreditsPage() {
  const { user } = await requireUser();

  const [summary, transactions] = await Promise.all([
    getSummary(user.id),
    listTransactions(user.id, 30),
  ]);

  return (
    <>
      <PageHeader
        title="الرصيد"
        description={`رصيد واحد = معروض واحد بـ${PRICE_PER_LETTER_SAR} ريالاً شاملة الضريبة. أدوات التحسين مشمولة.`}
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

      {/* --- شراء رصيد — #D-042 --- */}
      <h2 className="mb-4 mt-8 font-semibold">شراء رصيد</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">المعروض الواحد</h3>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="tabular text-3xl font-bold">{PRICE_PER_LETTER_SAR}</span>
            <span className="text-sm text-muted-foreground">ريال · شامل الضريبة</span>
          </p>
          <ul className="mt-5 space-y-2">
            {LETTER_PRICE_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* الدفع الإلكتروني لم يُربط بعد: الشراء بالتواصل، والمسؤول يضيف الرصيد من لوحة المستخدمين. */}
        <Card className="flex flex-col p-6">
          <h3 className="font-semibold">كيف أشتري رصيداً؟</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            الدفع الإلكتروني قيد التجهيز. حالياً راسلنا بعدد المعاريض التي تحتاجها،
            وسنرسل لك طريقة الدفع ونضيف الرصيد إلى حسابك.
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
            <a
              href={`mailto:${site.supportEmail}?subject=${encodeURIComponent('شراء رصيد معاريض')}`}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Mail className="size-4" aria-hidden />
              راسلنا لشراء رصيد
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-[var(--radius-field)] border border-border px-4 py-2.5 text-sm hover:bg-surface-muted"
            >
              طرق التواصل
            </Link>
          </div>
        </Card>
      </div>

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
