import { AI_DISCLAIMER } from '@/config/site';
import { sanitizeHtml } from '@/features/letters/html';
import { cn } from '@/lib/utils/cn';

/**
 * معاينة الورقة A4 — نفس ما سيُطبع بالضبط.
 *
 * التنسيق كله في `.letter-paper` داخل globals.css، ويُستخدم للشاشة
 * وللطباعة معاً. هذا ما يجعل «معاينة» تعني معاينة فعلية لا تقريباً،
 * وهو أيضاً مسار PDF (docs/DECISIONS.md #D-008).
 *
 * التعقيم يجري هنا **مرة أخرى** رغم التعقيم عند الحفظ — دفاع عميق:
 * لا نثق بما في القاعدة (docs/SECURITY.md §7).
 */
export function PaperPreview({
  contentHtml,
  className,
}: {
  contentHtml: string;
  className?: string;
}) {
  const safeHtml = sanitizeHtml(contentHtml);

  return (
    <div className={cn('overflow-x-auto', className)}>
      <article
        className="letter-paper"
        // مخرَج المعقِّم حصراً — المكوّن الوحيد المسموح له بهذا.
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {/* إخلاء المسؤولية يظهر في المعاينة وفي الطباعة — متطلب AI_SYSTEM §13 */}
      <p className="mx-auto mt-4 max-w-[210mm] text-center text-xs leading-relaxed text-subtle-foreground print-hidden">
        {AI_DISCLAIMER}
      </p>
    </div>
  );
}
