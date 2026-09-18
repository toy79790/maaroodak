import type { Metadata } from 'next';
import { site } from '@/config/site';

/**
 * بيانات وصفية لصفحة عامة: العنوان والوصف والرابط المعياري وOpen Graph معاً.
 *
 * لماذا دالة: Next.js يدمج `openGraph` **استبدالاً لا دمجاً**. صفحة تحدّد
 * عنوانها دون `openGraph` ترث عنوان الرئيسية ورابطها في المشاركة، فتظهر
 * صفحة «الأسئلة الشائعة» عند مشاركتها بعنوان الرئيسية. الدالة تمنع النسيان.
 *
 * صورة المشاركة صريحة هنا: `app/opengraph-image.png` لا تُورَّث إلى صفحة
 * تعرّف `openGraph` بنفسها — اختبار E2E كشف أن كل الصفحات الفرعية كانت
 * تُشارَك بلا صورة.
 */
const OG_IMAGE = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
  alt: `${site.name} — ${site.tagline}`,
};
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  /** المسار بلا نطاق: `/faq` */
  path: string;
}): Metadata {
  const fullTitle = `${title} | ${site.name}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: site.locale,
      siteName: site.name,
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
