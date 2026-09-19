/**
 * ثوابت النظام. القيم القابلة للتغيير من لوحة التحكم تعيش في SystemSetting،
 * وهذه هي القيم الافتراضية التي تُستخدم عند غياب الإعداد.
 */

// --- الجلسات ----------------------------------------------------------------
export const SESSION_COOKIE_NAME = 'mrd_session';
export const CSRF_COOKIE_NAME = 'mrd_csrf';
export const SESSION_TTL_DAYS = 7;
export const SESSION_SLIDING_RENEWAL_HOURS = 24;
export const PASSWORD_RESET_TTL_MINUTES = 30;
export const BCRYPT_COST = 12;

// --- التسعير والرصيد — docs/DECISIONS.md #D-042 ----------------------------
/**
 * سعر المعروض الواحد بالريال، **شامل ضريبة القيمة المضافة**. رصيد واحد =
 * معروض واحد. للعرض في الواجهة فقط: الصفحات التسويقية تُبنى ثابتة وقت البناء،
 * فتغيير السعر يتطلب نشراً — عمداً، كي لا يختلف السعر المعروض عمّا يُحصَّل.
 */
export const PRICE_PER_LETTER_SAR = 30;

/** لا معاريض مجانية عند التسجيل. قابل للتعديل من الإعدادات (credits.signupBonus). */
export const SIGNUP_BONUS_CREDITS = 0;

/**
 * أدوات الذكاء الاصطناعي على معروض مدفوع مشمولة بلا رصيد، حتى هذا العدد لكل
 * معروض — يحمي تكلفة النموذج من الاستخدام المفرط. قابل للتعديل من الإعدادات.
 */
export const AI_TOOLS_PER_LETTER = 10;

/** تكلفة كل عملية بالرصيد — الافتراضي؛ القيمة الفعلية من SystemSetting. */
export const CREDIT_COSTS = {
  GENERATE_LETTER: 1,
  REGENERATE: 1,
  AI_TOOL: 0,
  FOLLOW_UP: 1,
  QUALITY_CHECK: 1,
} as const;

// --- حدود المدخلات ----------------------------------------------------------
export const LIMITS = {
  textAnswer: 500,
  textareaAnswer: 2000,
  letterTitle: 200,
  letterHtml: 100_000,
  feedbackComment: 1000,
  numberMin: -1_000_000_000_000,
  numberMax: 1_000_000_000_000,
  fileSizeBytes: 5 * 1024 * 1024,
  pageSizeDefault: 20,
  pageSizeMax: 100,
} as const;

// --- المعروض ----------------------------------------------------------------
/** خارج هذا النطاق يُصدر تحذير جودة — docs/AI_SYSTEM.md §6 */
export const LETTER_WORD_COUNT = { min: 120, max: 900 } as const;

/** الصيغة التي يستخدمها الذكاء الاصطناعي للمعلومات الناقصة. */
export const PLACEHOLDER_PATTERN = /\[أدخل\s+[^\]]{1,80}\]/g;

// --- تحديد المعدّل ----------------------------------------------------------
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60_000 },
  register: { limit: 3, windowMs: 60 * 60_000 },
  forgotPassword: { limit: 3, windowMs: 60 * 60_000 },
  generate: { limit: 5, windowMs: 10 * 60_000 },
  aiTool: { limit: 20, windowMs: 10 * 60_000 },
  followUp: { limit: 10, windowMs: 10 * 60_000 },
  api: { limit: 100, windowMs: 60_000 },
} as const;

// --- الذكاء الاصطناعي --------------------------------------------------------
export const AI_DEFAULTS = {
  generateModel: 'claude-opus-5',
  toolsModel: 'claude-sonnet-5',
  qualityModel: 'claude-opus-5',
  followUpModel: 'claude-sonnet-5',
  generateEffort: 'high',
  toolsEffort: 'medium',
  generateMaxTokens: 8000,
  toolsMaxTokens: 4000,
  timeoutMs: 90_000,
} as const;

// --- المدن السعودية (للاقتراح في الملف الشخصي والأسئلة) ----------------------
export const SAUDI_CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر',
  'الظهران', 'الطائف', 'بريدة', 'تبوك', 'خميس مشيط', 'أبها', 'حائل',
  'نجران', 'جازان', 'ينبع', 'الأحساء', 'القطيف', 'عرعر', 'سكاكا',
  'الباحة', 'الجبيل', 'الخرج', 'حفر الباطن', 'القريات', 'بيشة',
] as const;
