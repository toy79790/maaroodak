import 'server-only';

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  StorageError,
  type PutObjectInput,
  type SignedUrlOptions,
  type StoragePort,
  type StoredObject,
} from '@/services/storage/ports';

/**
 * تخزين على القرص — **للتطوير المحلي فقط**.
 *
 * لا يصلح للإنتاج: منصات الاستضافة تشغّل حاويات بنظام ملفات مؤقت وغير
 * مشترك، فالملف يختفي عند إعادة النشر ولا تراه النسخ الأخرى. لهذا يرفض
 * `getStorage()` استخدامه في البيئات المنشورة.
 *
 * المجلد خارج `public/` عمداً: الملفات تُقدَّم عبر مسار يفحص الملكية
 * أولاً، لا كملفات ثابتة يصلها أي أحد بتخمين الاسم.
 */

const ROOT = resolve(process.cwd(), '.storage');

export class LocalStorage implements StoragePort {
  readonly driver = 'local';
  readonly isReady = true;

  /**
   * يمنع الخروج من مجلد التخزين عبر `../` في المفتاح.
   * المفاتيح تُولَّد داخلياً، لكن الاعتماد على ذلك وحده هشّ.
   */
  private pathFor(key: string): string {
    const target = resolve(ROOT, key);

    if (!target.startsWith(ROOT)) {
      throw new StorageError('unknown', 'مفتاح ملف غير صالح.');
    }

    return target;
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const path = this.pathFor(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);

    // نوع المحتوى يُحفظ بجانب الملف لأن نظام الملفات لا يحمل بيانات وصفية.
    await writeFile(`${path}.meta`, input.contentType, 'utf8');

    return {
      key: input.key,
      size: input.body.byteLength,
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
    await rm(`${this.pathFor(key)}.meta`, { force: true });
  }

  /**
   * لا توقيع محلياً — يُرجَع مسار داخلي يفحص الملكية قبل البثّ.
   * نفس شكل الاستدعاء في الحالتين، فلا يتغيّر كود المستدعي عند النشر.
   */
  async signedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const params = new URLSearchParams({ key });

    if (options.downloadName) {
      params.set('name', options.downloadName);
    }

    return `/api/files?${params.toString()}`;
  }

  /** مسار الملف على القرص — للاختبارات وأدوات التطوير. */
  static pathOf(key: string): string {
    return join(ROOT, key);
  }
}
