'use client';

import * as React from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { publicEnv } from '@/config/public-env';

/**
 * Google Analytics 4 — docs/DECISIONS.md #D-037
 *
 * التفعيل بمتغيّر بيئة واحد: `NEXT_PUBLIC_GA_MEASUREMENT_ID`. بدونه لا يُحمَّل
 * شيء إطلاقاً.
 *
 * ⚠️ الخصوصية: نقيس **الصفحات العامة فقط**. صفحات الحساب والمعاريض والإدارة
 * قد تحمل في عناوينها موضوع معروض أو اسم جهة — وهي بيانات حالة شخصية لا
 * تُرسل إلى طرف ثالث. لذلك:
 *   · `send_page_view: false` — لا قياس تلقائي عند التحميل.
 *   · نرسل `page_view` يدوياً حين يكون المسار عاماً.
 *   · يجب **تعطيل** «Page changes based on browser history events» من
 *     إعدادات Enhanced measurement في GA، وإلا قاس GA التنقّل داخل التطبيق
 *     بنفسه متجاوزاً هذا الفلتر (docs/DEPLOYMENT.md).
 */

/** المسارات العامة القابلة للقياس — كل ما عداها لا يُرسل. */
const PUBLIC_PATHS = [
  '/',
  '/about',
  '/contact',
  '/faq',
  '/departments',
  '/request-types',
  '/privacy',
  '/terms',
  '/ai-disclaimer',
  '/login',
  '/register',
];

function isMeasurable(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const id = publicEnv.gaMeasurementId;
  const pathname = usePathname();

  React.useEffect(() => {
    if (!id || !pathname || !isMeasurable(pathname)) return;
    // `gtag` يُعرَّف في السكربت المضمَّن أدناه قبل تحميل المكتبة، فيصطفّ الحدث
    // حتى لو لم تكتمل المكتبة بعد.
    window.gtag?.('event', 'page_view', {
      page_location: `${publicEnv.appUrl}${pathname}`,
      page_path: pathname,
    });
  }, [id, pathname]);

  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${id}', { send_page_view: false, anonymize_ip: true });`}
      </Script>
    </>
  );
}
