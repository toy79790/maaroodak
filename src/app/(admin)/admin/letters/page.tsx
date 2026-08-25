import type { Metadata } from 'next';
import { Files, Lock } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { PageHeader, EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LETTER_STATUS_LABEL, LETTER_STATUS_TONE } from '@/features/letters/labels';
import { formatArabicDate } from '@/lib/utils/arabic';

export const metadata: Metadata = { title: 'المعاريض' };

/**
 * عرض إداري للمعاريض — **بيانات وصفية فقط**.
 *
 * لا يُقرأ `contentHtml` ولا `answers` هنا. الإدارة تحتاج معرفة الحجم
 * والتوزيع والحالة، لا قراءة ظروف الناس المالية والصحية
 * (docs/SECURITY.md §11 · صلاحية `letter:readContent`).
 */
export default async function AdminLettersPage() {
  await requirePermission('letter:readAll');

  const letters = await prisma.letter.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      currentVersion: true,
      createdAt: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
      user: { select: { name: true } },
      _count: { select: { versions: true, feedbacks: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="المعاريض"
        description="أحدث 100 معروض — بيانات وصفية فقط."
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-field)] border border-info/30 bg-info-subtle px-4 py-3">
        <Lock className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden />
        <p className="text-sm leading-relaxed text-info">
          محتوى المعاريض لا يُعرض هنا. يتضمن ظروفاً شخصية ومالية وصحية، والإدارة
          تحتاج الإحصاءات لا قراءة خطابات المستخدمين.
        </p>
      </div>

      {letters.length === 0 ? (
        <EmptyState
          icon={Files}
          title="لا توجد معاريض بعد"
          description="ستظهر هنا فور إنشاء المستخدمين لمعاريضهم."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                {['المستخدم', 'الجهة', 'نوع الطلب', 'الحالة', 'النسخ', 'التاريخ'].map(
                  (header) => (
                    <th
                      key={header}
                      scope="col"
                      className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-muted-foreground"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {letters.map((letter) => (
                <tr key={letter.id} className="hover:bg-surface-muted/40">
                  <td className="max-w-40 truncate px-4 py-3">{letter.user.name}</td>
                  <td className="max-w-48 truncate px-4 py-3">
                    {letter.department.name}
                  </td>
                  <td className="max-w-40 truncate px-4 py-3">
                    {letter.requestType.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={LETTER_STATUS_TONE[letter.status] ?? 'neutral'}>
                      {LETTER_STATUS_LABEL[letter.status] ?? letter.status}
                    </Badge>
                  </td>
                  <td className="tabular px-4 py-3">{letter._count.versions}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatArabicDate(letter.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card className="mt-6 p-4">
        <p className="text-xs text-muted-foreground">
          للتوزيع حسب الجهة ونوع الطلب ومقاييس القمع، انظر لوحة الإدارة الرئيسية.
        </p>
      </Card>
    </>
  );
}
