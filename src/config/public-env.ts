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

export const publicEnv = {
  /** الأصل المعياري بلا شرطة أخيرة. */
  appUrl: rawAppUrl.replace(/\/+$/, ''),

  /**
   * بريد الدعم — يظهر في التذييل وسياسة الخصوصية.
   * قابل للضبط لأنه يتغيّر مع النطاق، وليس سرّاً فلا ضير في ظهوره للعميل.
   */
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@maroudak.sa',
} as const;

/** رابط مطلق من مسار نسبي — صالح على الخادم والعميل معاً. */
export function publicUrl(path = '/'): string {
  return `${publicEnv.appUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
