/**
 * أدوات النص العربي.
 *
 * السبب في وجود هذا الملف: المقارنات والتحقق والفحوص الأمنية تفشل صامتةً
 * على النص العربي إن لم يُطبَّع أولاً — الأرقام العربية-الهندية، والمحارف
 * الاتجاهية غير المرئية، وصور الهمزة المختلفة.
 *
 * المحارف غير المرئية تُفحص بنقطة الترميز (code point) لا بأنماط تحتوي
 * المحرف نفسه — لأن كتابتها حرفياً في الشيفرة تجعل الملف غير قابل للمراجعة
 * وعرضة للتلف عند النسخ أو تغيير الترميز.
 */

// ---------------------------------------------------------------------------
// فحوص نقاط الترميز
// ---------------------------------------------------------------------------

/** ٠-٩ : U+0660..U+0669 */
const ARABIC_INDIC_ZERO = 0x0660;
/** ۰-۹ : U+06F0..U+06F9 (فارسية) */
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

function arabicDigitValue(code: number): number | null {
  if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
    return code - ARABIC_INDIC_ZERO;
  }
  if (
    code >= EXTENDED_ARABIC_INDIC_ZERO &&
    code <= EXTENDED_ARABIC_INDIC_ZERO + 9
  ) {
    return code - EXTENDED_ARABIC_INDIC_ZERO;
  }
  return null;
}

/** التشكيل والعلامات المركّبة العربية. */
function isTashkeel(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) || // الفتحة … والعلامات الملحقة
    code === 0x0670 || // الألف الخنجرية
    (code >= 0x06d6 && code <= 0x06ed) // علامات المصحف
  );
}

/** التطويل ـ : U+0640 */
function isTatweel(code: number): boolean {
  return code === 0x0640;
}

/**
 * المحارف الاتجاهية وصفرية العرض:
 * U+200B..U+200F · U+202A..U+202E · U+2066..U+2069 · U+FEFF
 */
function isBidiOrZeroWidth(code: number): boolean {
  return (
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** محارف تحكم ASCII — مع السماح بـ TAB و LF و CR. */
function isDisallowedControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  return code < 0x20 || code === 0x7f;
}

// ---------------------------------------------------------------------------
// التحويلات
// ---------------------------------------------------------------------------

/** ٠١٢٣٤٥٦٧٨٩ / ۰۱۲۳۴۵۶۷۸۹ → 0123456789 */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const value = arabicDigitValue(ch.codePointAt(0) ?? 0);
    out += value === null ? ch : String(value);
  }
  return out;
}

/** إزالة المحارف الاتجاهية وصفرية العرض. */
export function stripBidiControls(input: string): string {
  let out = '';
  for (const ch of input) {
    if (!isBidiOrZeroWidth(ch.codePointAt(0) ?? 0)) out += ch;
  }
  return out;
}

/** إزالة التشكيل والتطويل. */
export function stripDiacritics(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isTashkeel(code) && !isTatweel(code)) out += ch;
  }
  return out;
}

/** صور الحروف التي تُوحَّد قبل المقارنة والبحث. */
const LETTER_FOLDING: ReadonlyMap<string, string> = new Map([
  ['آ', 'ا'],
  ['أ', 'ا'],
  ['إ', 'ا'],
  ['ٱ', 'ا'],
  ['ة', 'ه'],
  ['ى', 'ي'],
]);

/**
 * توحيد صور الألف والهمزة والتاء المربوطة والياء.
 * للمقارنة والبحث فقط — لا يُستخدم على نص يُعرض للمستخدم.
 */
export function normalizeArabic(input: string): string {
  let out = '';
  for (const ch of stripDiacritics(stripBidiControls(input))) {
    out += LETTER_FOLDING.get(ch) ?? ch;
  }
  return out.trim();
}

/** تنظيف مدخل نصي من المستخدم قبل التخزين. */
export function sanitizeUserText(input: string): string {
  let cleaned = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (isBidiOrZeroWidth(code) || isDisallowedControl(code)) continue;
    cleaned += ch;
  }

  return cleaned
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** مفتاح البحث: عربي مُطبَّع + أرقام لاتينية + حالة صغيرة. */
export function searchKey(input: string): string {
  return normalizeArabic(toLatinDigits(input)).toLowerCase();
}

/**
 * استخراج كل الأعداد من نص — أساس فحص «الأرقام المخترعة»
 * في docs/AI_SYSTEM.md §6. يتعامل مع الأرقام العربية-الهندية
 * والفواصل الألفية (، و ,) والكسور العشرية.
 */
export function extractNumbers(input: string): string[] {
  const latin = toLatinDigits(input);
  const matches = latin.match(/\d[\d,،]*(?:\.\d+)?/g) ?? [];

  return matches
    .map((m) => m.replace(/[,،]/g, ''))
    .map((m) => (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m))
    .filter((m) => m.length > 0);
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const;

/** تاريخ ميلادي بالعربية: «25 أغسطس 2026» */
export function formatArabicDate(date: Date): string {
  const month = ARABIC_MONTHS[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** عدد الكلمات — يتجاهل المسافات المتعددة وعلامات الترقيم المنفردة. */
export function countWords(input: string): number {
  return input
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
