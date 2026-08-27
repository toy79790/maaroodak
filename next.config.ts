import type { NextConfig } from 'next';

/**
 * إعداد Next.js للإنتاج.
 *
 * ⚠️ هذا الملف يعمل خارج نطاق `src/config/env.ts` (يُنفَّذ قبل التطبيق
 * وفي Edge runtime)، فيقرأ `process.env` مباشرة ولا يستورد شيئاً من `src/`.
 * التحقق الكامل من البيئة يبقى في `env.ts` عند إقلاع التطبيق.
 */

const APP_ENV = process.env.APP_ENV ?? 'development';
const isDeployed = APP_ENV === 'production' || APP_ENV === 'staging';
const isDev = process.env.NODE_ENV === 'development';

/** النطاق المعياري مشتقّ من متغيّر البيئة — لا نطاق ثابت في الشيفرة. */
function canonicalHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return null;

  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/* ==========================================================================
   ترويسات الأمان — docs/SECURITY.md §7 و §8
   ========================================================================== */

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' لازم لـ React Refresh في التطوير فقط.
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-ancestors *",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(isDeployed
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // الفحص الصحي لا يُخزَّن — قيمته في كونه لحظياً.
        source: '/api/health',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },

  /**
   * توحيد النطاق — docs/DEPLOYMENT.md §8
   *
   * `CANONICAL_HOST_MODE`:
   *   www   ⟶ example.com يُحوَّل إلى www.example.com
   *   apex  ⟶ www.example.com يُحوَّل إلى example.com
   *   none  ⟶ لا تحويل (الافتراضي — مناسب للتطوير ولمنصات تتولّى التحويل)
   *
   * التحويل دائم (308) ليحفظ الطريقة والجسم، ولتفهمه محركات البحث كنقل نهائي.
   */
  async redirects() {
    const mode = process.env.CANONICAL_HOST_MODE ?? 'none';
    const host = canonicalHost();

    if (mode === 'none' || !host) return [];

    const apex = host.replace(/^www\./, '');
    const www = `www.${apex}`;

    const from = mode === 'www' ? apex : www;
    const to = mode === 'www' ? www : apex;

    if (from === to) return [];

    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: from }],
        destination: `https://${to}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
