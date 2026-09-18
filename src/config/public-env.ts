/**
 * متغيرات البيئة الآمنة للمتصفح.
 *
 * ⚠️ Next.js يُدمج قيم `NEXT_PUBLIC_*` في حزمة العميل **وقت البناء**، فهي
 * ليست سرّية بأي حال. لا يُضاف هنا أي مفتاح أو كلمة مرور أو رمز وصول —
 * ولهذا لا يُستورد `src/config/env.ts` في أي مكوّن عميل.
 *
 * أثر عملي على النشر: تغيير `NEXT_PUBLIC_APP_URL` يتطلب **إعادة بناء**،
 * لا مجرّد إعادة تشغيل (docs/ENVIRONMENT.md).
 */

const rawAppUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';

const appUrl = rawAppUrl.replace(/\/+$/, '');

/** `support@<النطاق>` — تراجع مشتق من النطاق نفسه، فلا نطاق مكتوب هنا (#D-026). */
function defaultSupportEmail(): string {
  try {
    return `support@${new URL(appUrl).hostname.replace(/^www\./, '')}`;
  } catch {
    return '';
  }
}

function gaMeasurementId(): string {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '';
  return /^G-[A-Z0-9]{4,20}$/.test(raw) ? raw : '';
}

export const publicEnv = {
  /** الأصل المعياري بلا شرطة أخيرة. */
  appUrl,

  /**
   * بريد الدعم — يظهر في التذييل وسياسة الخصوصية.
   * قابل للضبط لأنه يتغيّر مع النطاق، وليس سرّاً فلا ضير في ظهوره للعميل.
   */
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || defaultSupportEmail(),

  /**
   * Google Analytics 4 — معرّف القياس (`G-XXXXXXX`). فارغاً لا يُحمَّل أي سكربت
   * ولا تُضاف أي نطاقات إلى CSP. قيمة بصيغة خاطئة تُعامَل كفارغة: سكربت تتبّع
   * بمعرّف تالف يرسل بيانات الزوار إلى لا شيء.
   */
  gaMeasurementId: gaMeasurementId(),

  /** رمز التحقق من Google Search Console (قيمة `content` فقط، بلا وسم meta). */
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ?? '',
} as const;

/** رابط مطلق من مسار نسبي — صالح على الخادم والعميل معاً. */
export function publicUrl(path = '/'): string {
  return `${publicEnv.appUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
