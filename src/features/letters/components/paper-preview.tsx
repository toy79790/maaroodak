'use client';

import * as React from 'react';
import { AI_DISCLAIMER } from '@/config/site';
import { sanitizeHtml } from '@/features/letters/html';
import { cn } from '@/lib/utils/cn';

/** عرض A4 بالبكسل عند 96 نقطة/بوصة — يطابق `--paper-width: 210mm`. */
const PAPER_WIDTH_PX = (210 * 96) / 25.4;

/**
 * معاينة الورقة A4 — نفس ما سيُطبع بالضبط.
 *
 * التنسيق كله في `.letter-paper` داخل globals.css، ويُستخدم للشاشة
 * وللطباعة معاً. هذا ما يجعل «معاينة» تعني معاينة فعلية لا تقريباً،
 * وهو أيضاً مسار PDF (docs/DECISIONS.md #D-008).
 *
 * التصغير بـ `zoom` محسوباً من عرض الحاوية الفعلي — #D-050. كان `transform`
 * بقيمة ثابتة 0.62: تناسب شاشة ~490px فتُقصّ الأسطر على الجوال، ولا تسري
 * فوق 900px رغم أن الشريط الجانبي يضيّق الحاوية على الحواسيب الصغيرة.
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const fit = () => setZoom(Math.min(1, container.clientWidth / PAPER_WIDTH_PX));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn('overflow-x-auto', className)}>
      <article
        className="letter-paper"
        style={{ '--paper-zoom': zoom } as React.CSSProperties}
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
