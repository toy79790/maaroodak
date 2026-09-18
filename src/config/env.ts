import { z } from 'zod';

/**
 * متغيرات البيئة — تُتحقَّق عند الإقلاع.
 * المرجع الكامل لكل متغيّر: docs/ENVIRONMENT.md
 *
 * الفشل هنا مقصود وفوري: خادم يعمل بإعدادات ناقصة أسوأ من خادم لا يعمل،
 * لأن الخلل يظهر عند أول مستخدم لا عند النشر.
 *
 * ⚠️ هذا الملف **للخادم فقط**. لما يحتاجه المتصفح انظر `src/config/public-env.ts`.
 */

/**
 * `APP_ENV` منفصل عن `NODE_ENV` عمداً.
 *
 * `NODE_ENV` يصفه Next.js بأنه وضع البناء (`production` حتى في بناء محلي)،
 * فلا يصلح للتمييز بين staging و production — وهما بيئتان بقواعد بيانات
 * ومفاتيح مختلفة يجب ألّا تختلطا.
 */
const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** اتجاه التحويل بين النطاق الجذري و www — docs/DEPLOYMENT.md §8 */
const CANONICAL_MODES = ['www', 'apex', 'none'] as const;
export type CanonicalMode = (typeof CANONICAL_MODES)[number];

const STORAGE_DRIVERS = ['local', 's3'] as const;
export type StorageDriver = (typeof STORAGE_DRIVERS)[number];

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const optionalString = z
  .string()
  .optional()
  .default('')
  .transform((value) => value.trim());

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(APP_ENVS).default('development'),

  // --- قاعدة البيانات -------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL مطلوب'),
  DATABASE_URL_TEST: optionalString,
  /**
   * اتصال مباشر للترحيلات فقط — يقرؤه Prisma من البيئة لا من هنا.
   * مُعرَّف هنا للتوثيق ولمنع اعتباره متغيّراً مجهولاً (#D-032).
   */
  DIRECT_DATABASE_URL: optionalString,

  // --- الجلسات --------------------------------------------------------------
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET يجب أن يكون 32 حرفاً على الأقل'),

  // --- الذكاء الاصطناعي ------------------------------------------------------
  /** بدونه تعمل المنصة بكل شيء عدا التوليد. */
  ANTHROPIC_API_KEY: optionalString,

  // --- النطاق ---------------------------------------------------------------
  /**
   * مصدر الحقيقة للنطاق. يُستخدم في الروابط المعيارية وخريطة الموقع و OG
   * وفحص Origin. لا يُكتب أي نطاق داخل الشيفرة.
   */
  NEXT_PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  /** تجاوز اختياري للخادم فقط — يُستخدم حين يختلف العنوان الداخلي عن العام. */
  APP_URL: optionalString,
  CANONICAL_HOST_MODE: z.enum(CANONICAL_MODES).default('none'),
  /** نطاقات إضافية مسموح بها في CORS، مفصولة بفواصل. */
  ALLOWED_ORIGINS: optionalString,

  // --- التخزين --------------------------------------------------------------
  STORAGE_DRIVER: z.enum(STORAGE_DRIVERS).default('local'),
  STORAGE_ENDPOINT: optionalString,
  STORAGE_REGION: z.string().optional().default('auto'),
  STORAGE_BUCKET: optionalString,
  STORAGE_ACCESS_KEY_ID: optionalString,
  STORAGE_SECRET_ACCESS_KEY: optionalString,
  /** الأصل العام للملفات (CDN أو نطاق الحاوية). */
  STORAGE_PUBLIC_URL: optionalString,

  // --- السجلات والمراقبة -----------------------------------------------------
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** رمز خدمة رصد الأخطاء — اختياري. */
  SENTRY_DSN: optionalString,

  // --- البريد ---------------------------------------------------------------
  /** عنوان المرسِل. فارغاً يُشتق `no-reply@<النطاق>` من NEXT_PUBLIC_APP_URL. */
  MAIL_FROM: optionalString,
  /** smtps://user:pass@host:465 — بدونه لا يُرسل بريد (روابط الاستعادة تُسجَّل في التطوير فقط). */
  SMTP_URL: optionalString,
});

export type ServerEnv = z.infer<typeof serverSchema>;

const INSECURE_DEFAULT_SECRET =
  'change-me-to-a-long-random-string-at-least-32-chars';

/**
 * Next.js يضبط `NODE_ENV=production` أثناء البناء أيضاً، فلو فرضنا فحوص
 * الإنتاج وقت التجميع لفشل كل بناء محلي. الفحوص تخصّ التشغيل لا التجميع.
 */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function assertProductionSafety(env: ServerEnv): void {
  const problems: string[] = [];

  if (env.SESSION_SECRET === INSECURE_DEFAULT_SECRET) {
    problems.push('SESSION_SECRET ما زال على القيمة التطويرية الافتراضية.');
  }

  if (!env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
    problems.push('NEXT_PUBLIC_APP_URL يجب أن يستخدم HTTPS في الإنتاج.');
  }

  if (env.APP_URL && !env.APP_URL.startsWith('https://')) {
    problems.push('APP_URL يجب أن يستخدم HTTPS في الإنتاج.');
  }

  if (env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    problems.push('NEXT_PUBLIC_APP_URL يشير إلى localhost.');
  }

  /*
   * نرفض **قاعدة التطوير** تحديداً لا كل `localhost`: على خادم Oracle تعمل
   * PostgreSQL على المضيف نفسه (#D-033)، فرفض localhost كان يُسقط كل إقلاع
   * إنتاج. بصمة قاعدة التطوير: المنفذ 5433 أو بيانات الاعتماد الافتراضية.
   */
  if (/:5433\//.test(env.DATABASE_URL) || /\/\/postgres:postgres@/.test(env.DATABASE_URL)) {
    problems.push(
      'DATABASE_URL يطابق قاعدة التطوير (المنفذ 5433 أو postgres:postgres) — استخدم قاعدة الإنتاج ومستخدماً بكلمة مرور قوية.',
    );
  }

  // التخزين السحابي بلا بيانات اعتماد يفشل عند أول رفع لا عند الإقلاع.
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.STORAGE_BUCKET) problems.push('STORAGE_BUCKET مطلوب مع STORAGE_DRIVER=s3.');
    if (!env.STORAGE_ACCESS_KEY_ID) {
      problems.push('STORAGE_ACCESS_KEY_ID مطلوب مع STORAGE_DRIVER=s3.');
    }
    if (!env.STORAGE_SECRET_ACCESS_KEY) {
      problems.push('STORAGE_SECRET_ACCESS_KEY مطلوب مع STORAGE_DRIVER=s3.');
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `إعدادات غير صالحة لبيئة الإنتاج:\n${problems.map((p) => `  · ${p}`).join('\n')}`,
    );
  }
}

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`متغيرات البيئة غير صالحة:\n${issues}`);
  }

  const env = parsed.data;

  if (env.APP_ENV === 'production' && !isBuildPhase()) {
    assertProductionSafety(env);
  }

  return env;
}

export const env = loadEnv();

// ---------------------------------------------------------------------------
// مشتقّات جاهزة — تمنع تكرار المنطق في كل مستدعٍ
// ---------------------------------------------------------------------------

export const appEnv: AppEnv = env.APP_ENV;

export const isProduction = env.APP_ENV === 'production';
export const isStaging = env.APP_ENV === 'staging';
export const isDevelopment = env.APP_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

/** بيئة منشورة (staging أو production) — تفرض HTTPS والكوكيز الآمنة. */
export const isDeployed = isProduction || isStaging;

/** الأصل المعياري بلا شرطة أخيرة — مصدر كل رابط مطلق. */
export const appUrl = (env.APP_URL || env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, '');

/** الأصل العام كما يراه المتصفح — قد يختلف عن `appUrl` خلف وكيل داخلي. */
export const publicAppUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');

/** هل خدمة الذكاء الاصطناعي مُهيّأة؟ لتعطيل الأزرار بلطف بدل الفشل. */
export const isAIConfigured = env.ANTHROPIC_API_KEY.length > 0;

/** الأصول المسموح بها في فحص Origin و CORS. */
export const allowedOrigins: readonly string[] = [
  publicAppUrl,
  ...(appUrl !== publicAppUrl ? [appUrl] : []),
  ...env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0),
];

/** رابط مطلق من مسار نسبي — للروابط المعيارية والبريد وخريطة الموقع. */
export function absoluteUrl(path = '/'): string {
  return `${publicAppUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
