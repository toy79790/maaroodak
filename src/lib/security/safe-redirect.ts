/**
 * مسار العودة بعد تسجيل الدخول — حماية من إعادة التوجيه المفتوحة (Open Redirect).
 *
 * الفحص القديم (`startsWith('/') && !startsWith('//')`) كان نصياً، والمتصفح لا
 * يقرأ الرابط نصياً: يعامل `\` كـ`/` ويحذف محارف الجدولة والأسطر. فكان
 * `/\example.com` و`/<tab>/example.com` يعبران الفحص ثم يصيران `//example.com`
 * — خارج الموقع. ثبت ذلك باختبار متصفح فعلي قبل الإصلاح (#D-043).
 *
 * الحل: نحلّل القيمة بمحلّل URL نفسه الذي يستخدمه المتصفح، على أصل وهمي، ونقبل
 * فقط ما بقي على ذلك الأصل. ما لا يُحلَّل أو يخرج عنه ⇒ المسار الافتراضي.
 */

/** أصل وهمي محجوز (`.invalid` — RFC 2606) لا يمكن أن يطابقه رابط حقيقي. */
const PROBE_ORIGIN = 'http://redirect-probe.invalid';

export function safeRedirectPath(
  next: string | null | undefined,
  fallback = '/dashboard',
): string {
  if (!next) return fallback;

  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return fallback;
  }

  // أي مخطط آخر (javascript:، data:، https://…) أو نطاق آخر ⇒ خارج الموقع.
  if (url.origin !== PROBE_ORIGIN) return fallback;

  const path = `${url.pathname}${url.search}${url.hash}`;

  // `//x` بعد التحليل = رابط بلا مخطط إلى نطاق آخر حين يُمرَّر للموجّه.
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;

  return path;
}
