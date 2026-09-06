import type { Metadata, Viewport } from 'next';
import { Cairo, Amiri } from 'next/font/google';
import { Toaster } from 'sonner';
import { site } from '@/config/site';
import { cn } from '@/lib/utils/cn';
import './globals.css';

/** خط الواجهة — Cairo: هندسي واضح وممتاز على الشاشات الصغيرة. */
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

/** خط المعروض — Amiri: نسخ تقليدي يليق بالخطاب الرسمي المطبوع. */
const amiri = Amiri({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    'معروض',
    'كتابة معروض',
    'خطاب رسمي',
    'صيغة معروض',
    'معروض للديوان الملكي',
    'طلب مساعدة مالية',
    'تظلم',
    'شكوى رسمية',
    'خطابات حكومية',
  ],
  authors: [{ name: site.name }],
  /**
   * الرابط المعياري — يمنع تشتّت الأرشفة حين يصل الزائر بمعاملات تتبّع
   * (`?utm_source=…`) أو عبر نسخة www مقابل الجذر. النسبي `'/'` يُحلّ
   * على `metadataBase`، فلا نطاق مكتوب في الشيفرة.
   */
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  // أخضر العلامة — نفس `--color-brand-600` بعد تحويله إلى sRGB.
  // كان `#0f766e` (فيروزي) لا يطابق أي لون في نظام التصميم.
  themeColor: '#0e6f52',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* متغيّرات الخطوط على <html> لا على <body>: رموز @theme تُعرَّف على
       :root، و`--font-sans: var(--font-cairo)` هناك لا يرى متغيّراً معرّفاً
       على <body> — فيصبح الرمز غير صالح ويسقط الخط كله إلى افتراضي النظام. */
    <html
      lang="ar"
      dir="rtl"
      className={cn(cairo.variable, amiri.variable)}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
        />
      </body>
    </html>
  );
}
