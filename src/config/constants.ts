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

// --- الرصيد -----------------------------------------------------------------
export const SIGNUP_BONUS_CREDITS = 3;

/** تكلفة كل عملية بالـ Credits — قابلة للتعديل من SystemSetting. */
export const CREDIT_COSTS = {
  GENERATE_LETTER: 1,
  REGENERATE: 1,
  AI_TOOL: 1,
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
