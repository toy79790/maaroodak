import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import { env } from '@/config/env';
import {
  StorageError,
  type PutObjectInput,
  type SignedUrlOptions,
  type StoragePort,
  type StoredObject,
} from '@/services/storage/ports';

/**
 * تخزين متوافق مع S3 — AWS S3 · Cloudflare R2 · DigitalOcean Spaces · MinIO.
 *
 * موقّع SigV4 مكتوب يدوياً بدل إضافة `@aws-sdk/client-s3` (نحو 3 ميجابايت
 * وعشرات التبعيات) لعملية واحدة نحتاجها. الخوارزمية موثّقة ومستقرة منذ 2012،
 * والاختبارات في `tests/unit/storage/` تُثبت صحة التوقيع.
 *
 * يُستخدم نمط `path-style` (`endpoint/bucket/key`) لأنه الوحيد الذي يعمل
 * على كل المزوّدين المتوافقين؛ نمط `virtual-host` يخصّ AWS وحدها.
 */

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

function sha256Hex(data: string | Buffer | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * ترميز مسار المفتاح.
 * `encodeURIComponent` يترك `!'()*` بلا ترميز وتلك تكسر التوقيع، وتُرمَّز
 * الشرطات المائلة كفواصل مسار لا كمحارف.
 */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function amzDate(now: Date): { full: string; short: string } {
  const full = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { full, short: full.slice(0, 8) };
}

function signingKey(secret: string, short: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, short);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, 'aws4_request');
}

export class S3Storage implements StoragePort {
  readonly driver = 's3';

  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicUrl: string;

  constructor() {
    this.endpoint = env.STORAGE_ENDPOINT.replace(/\/+$/, '');
    this.bucket = env.STORAGE_BUCKET;
    this.region = env.STORAGE_REGION || 'auto';
    this.accessKeyId = env.STORAGE_ACCESS_KEY_ID;
    this.secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;
    this.publicUrl = env.STORAGE_PUBLIC_URL.replace(/\/+$/, '');
  }

  get isReady(): boolean {
    return Boolean(
      this.endpoint && this.bucket && this.accessKeyId && this.secretAccessKey,
    );
  }

  private assertReady(): void {
    if (!this.isReady) {
      throw new StorageError(
        'not_configured',
        'التخزين السحابي غير مُهيّأ. راجع متغيرات STORAGE_* في docs/ENVIRONMENT.md',
      );
    }
  }

  private objectUrl(key: string): URL {
    return new URL(`${this.endpoint}/${this.bucket}/${encodeKey(key)}`);
  }

  /** توقيع الترويسة لطلب مباشر (رفع · قراءة · حذف). */
  private signRequest(
    method: string,
    url: URL,
    payloadHash: string,
    extraHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const now = new Date();
    const { full, short } = amzDate(now);

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': full,
      ...extraHeaders,
    };

    const sortedKeys = Object.keys(headers)
      .map((key) => key.toLowerCase())
      .sort();

    const canonicalHeaders = sortedKeys
      .map((key) => `${key}:${String(headers[key] ?? headers[key.toLowerCase()]).trim()}\n`)
      .join('');

    const signedHeaders = sortedKeys.join(';');

    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const scope = `${short}/${this.region}/${SERVICE}/aws4_request`;

    const stringToSign = [
      ALGORITHM,
      full,
      scope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const signature = hmac(
      signingKey(this.secretAccessKey, short, this.region),
      stringToSign,
    ).toString('hex');

    return {
      ...headers,
      Authorization:
        `${ALGORITHM} Credential=${this.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    this.assertReady();

    const url = this.objectUrl(input.key);
    const body = Buffer.from(input.body);
    const payloadHash = sha256Hex(body);

    const headers = this.signRequest('PUT', url, payloadHash, {
      'content-type': input.contentType,
      'content-length': String(body.byteLength),
      // الخصوصية افتراضية — الرابط الموقّت هو طريق الوصول الوحيد.
      'x-amz-acl': input.visibility === 'public' ? 'public-read' : 'private',
    });

    const response = await fetch(url, { method: 'PUT', headers, body });

    if (!response.ok) {
      throw new StorageError(
        'upload_failed',
        `فشل رفع الملف (${response.status}).`,
      );
    }

    return {
      key: input.key,
      size: body.byteLength,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer | null> {
    this.assertReady();

    const url = this.objectUrl(key);
    const headers = this.signRequest('GET', url, UNSIGNED_PAYLOAD);
    const response = await fetch(url, { method: 'GET', headers });

    if (response.status === 404) return null;

    if (!response.ok) {
      throw new StorageError('unknown', `تعذّر جلب الملف (${response.status}).`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    this.assertReady();

    const url = this.objectUrl(key);
    const headers = this.signRequest('HEAD', url, UNSIGNED_PAYLOAD);
    const response = await fetch(url, { method: 'HEAD', headers });

    return response.ok;
  }

  async delete(key: string): Promise<void> {
    this.assertReady();

    const url = this.objectUrl(key);
    const headers = this.signRequest('DELETE', url, UNSIGNED_PAYLOAD);
    const response = await fetch(url, { method: 'DELETE', headers });

    // 404 عند الحذف ليس خطأً — النتيجة المطلوبة محقّقة.
    if (!response.ok && response.status !== 404) {
      throw new StorageError('unknown', `تعذّر حذف الملف (${response.status}).`);
    }
  }

  /** رابط موقّت بمعامل استعلام (presigned URL) — لا يمرّ عبر خادمنا. */
  async signedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    this.assertReady();

    const expires = Math.min(Math.max(options.expiresInSeconds ?? 300, 30), 604800);
    const now = new Date();
    const { full, short } = amzDate(now);
    const scope = `${short}/${this.region}/${SERVICE}/aws4_request`;

    const url = this.objectUrl(key);
    url.searchParams.set('X-Amz-Algorithm', ALGORITHM);
    url.searchParams.set('X-Amz-Credential', `${this.accessKeyId}/${scope}`);
    url.searchParams.set('X-Amz-Date', full);
    url.searchParams.set('X-Amz-Expires', String(expires));
    url.searchParams.set('X-Amz-SignedHeaders', 'host');

    if (options.downloadName) {
      url.searchParams.set(
        'response-content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`,
      );
    }

    // المعاملات تُرتَّب أبجدياً في الطلب المعياري — وإلا فشل التحقق.
    url.searchParams.sort();

    const canonicalRequest = [
      'GET',
      url.pathname,
      url.searchParams.toString(),
      `host:${url.host}\n`,
      'host',
      UNSIGNED_PAYLOAD,
    ].join('\n');

    const stringToSign = [ALGORITHM, full, scope, sha256Hex(canonicalRequest)].join('\n');

    const signature = hmac(
      signingKey(this.secretAccessKey, short, this.region),
      stringToSign,
    ).toString('hex');

    url.searchParams.set('X-Amz-Signature', signature);

    // الحاوية العامة خلف CDN: يُستبدل الأصل مع بقاء التوقيع صالحاً.
    if (this.publicUrl) {
      return `${this.publicUrl}/${encodeKey(key)}${url.search}`;
    }

    return url.toString();
  }
}
