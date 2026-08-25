/**
 * حدود طبقة التخزين — docs/DEPLOYMENT.md §14
 *
 * لا تستورد أي SDK. المستدعي يعتمد على هذه الواجهة وحدها، فإضافة مزوّد
 * (S3 · R2 · Spaces · MinIO) = ملف تنفيذ واحد بلا تغيير في أي مكان آخر.
 *
 * ⚠️ لماذا لا نكتب في نظام ملفات الخادم في الإنتاج؟
 * منصات الاستضافة الحديثة تشغّل الحاويات بنظام ملفات **مؤقت وغير مشترك**:
 * الملف المكتوب على نسخة يختفي عند إعادة النشر ولا تراه النسخ الأخرى.
 */

export interface StoredObject {
  /** المفتاح داخل الحاوية — لا يُشتق من اسم الملف الأصلي أبداً. */
  key: string;
  size: number;
  contentType: string;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  /**
   * `private` افتراضياً. مرفقات المستخدمين تحوي بيانات شخصية ولا يجوز
   * أن تكون قابلة للتخمين بالرابط.
   */
  visibility?: 'private' | 'public';
}

export interface SignedUrlOptions {
  /** بالثواني — يُقصَّر عمداً لتقليل نافذة التسريب. */
  expiresInSeconds?: number;
  /** اسم التنزيل المعروض للمستخدم. */
  downloadName?: string;
}

export interface StoragePort {
  readonly driver: string;
  /** هل الإعدادات مكتملة؟ يُستخدم في الفحص الصحي وتعطيل الرفع بلطف. */
  readonly isReady: boolean;

  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  /**
   * رابط موقّت للقراءة. للمزوّدين الذين لا يدعمون التوقيع، يُرجَع مسار
   * داخلي يفحص الملكية قبل البثّ.
   */
  signedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
}

export class StorageError extends Error {
  readonly kind: 'not_configured' | 'not_found' | 'upload_failed' | 'unknown';

  constructor(
    kind: StorageError['kind'],
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'StorageError';
    this.kind = kind;
    this.cause = options.cause;
  }
}

/** حدود الرفع — docs/SECURITY.md §10 */
export const UPLOAD_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const,
} as const;

/**
 * الأرقام السحرية لبداية الملف.
 *
 * يُتحقق من النوع بمحتوى الملف لا بامتداده ولا بترويسة `Content-Type`:
 * كلاهما يتحكم فيه العميل، ورفع ملف تنفيذي باسم `.pdf` أمر تافه.
 */
const MAGIC_NUMBERS: ReadonlyArray<{ type: string; bytes: readonly number[] }> = [
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  // WEBP: "RIFF" ثم "WEBP" عند الإزاحة 8 — يُفحص أدناه.
];

export function detectContentType(buffer: Buffer | Uint8Array): string | null {
  for (const signature of MAGIC_NUMBERS) {
    const matches = signature.bytes.every(
      (byte, index) => buffer[index] === byte,
    );
    if (matches) return signature.type;
  }

  const isRiff =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;

  if (isRiff && isWebp) return 'image/webp';

  return null;
}

export interface UploadValidation {
  ok: boolean;
  contentType?: string;
  error?: string;
}

export function validateUpload(buffer: Buffer | Uint8Array): UploadValidation {
  if (buffer.byteLength === 0) {
    return { ok: false, error: 'الملف فارغ.' };
  }

  if (buffer.byteLength > UPLOAD_LIMITS.maxBytes) {
    const megabytes = Math.round(UPLOAD_LIMITS.maxBytes / 1024 / 1024);
    return { ok: false, error: `حجم الملف يتجاوز ${megabytes} ميجابايت.` };
  }

  const detected = detectContentType(buffer);

  if (!detected) {
    return { ok: false, error: 'نوع الملف غير مدعوم.' };
  }

  if (!UPLOAD_LIMITS.allowedTypes.includes(detected as never)) {
    return { ok: false, error: 'نوع الملف غير مسموح به.' };
  }

  return { ok: true, contentType: detected };
}
