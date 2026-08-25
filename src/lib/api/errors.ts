/**
 * نوع النتيجة الموحّد ورموز الأخطاء — docs/ARCHITECTURE.md §11 · docs/API.md §1
 *
 * القاعدة: الخدمات تُرجع Result للأخطاء **المتوقعة** (رصيد غير كافٍ، غير موجود،
 * تحقق فاشل) ولا ترميها كاستثناءات. الاستثناء يبقى للأعطال غير المتوقعة فقط.
 * هذا يجعل مسارات الفشل مرئية في نوع الدالة بدل أن تكون مفاجأة وقت التشغيل.
 */

export const ERROR_CODES = {
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AI_FAILED: 'AI_FAILED',
  AI_BLOCKED: 'AI_BLOCKED',
  AI_NOT_CONFIGURED: 'AI_NOT_CONFIGURED',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INSUFFICIENT_CREDITS: 402,
  QUOTA_EXCEEDED: 402,
  AI_FAILED: 502,
  AI_BLOCKED: 422,
  AI_NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

/** رسائل افتراضية عربية صالحة للعرض المباشر للمستخدم. */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'البيانات المُدخلة غير صحيحة.',
  UNAUTHORIZED: 'يلزم تسجيل الدخول للمتابعة.',
  FORBIDDEN: 'لا تملك صلاحية لهذا الإجراء.',
  NOT_FOUND: 'العنصر المطلوب غير موجود.',
  CONFLICT: 'يوجد تعارض مع بيانات موجودة مسبقاً.',
  RATE_LIMITED: 'عدد المحاولات كبير. يرجى المحاولة بعد قليل.',
  INSUFFICIENT_CREDITS: 'رصيدك لا يكفي لإتمام هذه العملية.',
  QUOTA_EXCEEDED: 'تجاوزت حد خطتك لهذا الشهر.',
  AI_FAILED: 'تعذّر إتمام العملية حالياً. يرجى إعادة المحاولة.',
  AI_BLOCKED: 'تعذّر توليد المحتوى. يرجى مراجعة صياغة إجاباتك وإعادة المحاولة.',
  AI_NOT_CONFIGURED: 'خدمة الذكاء الاصطناعي غير مُهيّأة حالياً.',
  INTERNAL: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.',
};

export interface AppErrorOptions {
  /** رسالة عربية للعرض — تُستبدل بالافتراضية إن غابت. */
  message?: string;
  /** أخطاء الحقول للنماذج: { email: 'بريد غير صالح' } */
  fields?: Record<string, string>;
  /** تفاصيل داخلية للتسجيل فقط — لا تُرسل للعميل أبداً. */
  cause?: unknown;
  /** بالثواني — يُستخدم مع RATE_LIMITED */
  retryAfter?: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  override readonly cause?: unknown;
  readonly retryAfter?: number;

  constructor(code: ErrorCode, options: AppErrorOptions | string = {}) {
    const opts: AppErrorOptions =
      typeof options === 'string' ? { message: options } : options;
    super(opts.message ?? DEFAULT_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.fields = opts.fields;
    this.cause = opts.cause;
    this.retryAfter = opts.retryAfter;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  /** الشكل الآمن للإرسال إلى العميل — بلا cause وبلا stack. */
  toClient(): { code: ErrorCode; message: string; fields?: Record<string, string> } {
    return {
      code: this.code,
      message: this.message,
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }
}

/** اختصارات للأخطاء الشائعة. */
export const errors = {
  validation: (fields?: Record<string, string>, message?: string) =>
    new AppError(ERROR_CODES.VALIDATION, { fields, ...(message ? { message } : {}) }),
  unauthorized: (message?: string) =>
    new AppError(ERROR_CODES.UNAUTHORIZED, { message }),
  forbidden: (message?: string) => new AppError(ERROR_CODES.FORBIDDEN, { message }),
  notFound: (message?: string) => new AppError(ERROR_CODES.NOT_FOUND, { message }),
  conflict: (message?: string) => new AppError(ERROR_CODES.CONFLICT, { message }),
  rateLimited: (retryAfter: number) =>
    new AppError(ERROR_CODES.RATE_LIMITED, { retryAfter }),
  internal: (cause?: unknown) => new AppError(ERROR_CODES.INTERNAL, { cause }),
} as const;

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: AppError): Result<T> {
  return { ok: false, error };
}

/** يحوّل أي قيمة مرمية إلى AppError — نقطة واحدة لا تسرّب تفاصيل داخلية. */
export function toAppError(thrown: unknown): AppError {
  if (thrown instanceof AppError) return thrown;
  return errors.internal(thrown);
}
