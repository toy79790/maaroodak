import 'server-only';

import { randomBytes } from 'node:crypto';
import { env, isDeployed } from '@/config/env';
import { LocalStorage } from '@/services/storage/local-storage';
import { S3Storage } from '@/services/storage/s3-storage';
import { StorageError, type StoragePort } from '@/services/storage/ports';

/**
 * اختيار مزوّد التخزين — docs/DEPLOYMENT.md §14
 */

let instance: StoragePort | null = null;

export function getStorage(): StoragePort {
  if (instance) return instance;

  if (env.STORAGE_DRIVER === 's3') {
    instance = new S3Storage();
    return instance;
  }

  /*
   * حارس صريح: تشغيل التخزين المحلي في بيئة منشورة يعني فقدان ملفات
   * المستخدمين بصمت عند أول إعادة نشر — وهو نوع الأعطال التي لا تُكتشف
   * إلا بعد فوات الأوان. الفشل عند الإقلاع أرحم بكثير.
   */
  if (isDeployed) {
    throw new StorageError(
      'not_configured',
      'التخزين المحلي غير مسموح في البيئات المنشورة. اضبط STORAGE_DRIVER=s3 وبيانات الاعتماد.',
    );
  }

  instance = new LocalStorage();
  return instance;
}

/** لحقن مزوّد وهمي في الاختبارات. */
export function setStorage(next: StoragePort | null): void {
  instance = next;
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * توليد مفتاح تخزين.
 *
 * ⚠️ لا يُشتق المفتاح من اسم الملف الأصلي إطلاقاً:
 *  · أسماء المستخدمين تحوي محارف تكسر المسارات وتفتح باب `../`.
 *  · اسم مثل «تقرير-طبي-محمد.pdf» يسرّب معلومة شخصية في الرابط نفسه.
 *  · الاسم المخمَّن يجعل الملف قابلاً للوصول بلا تخويل.
 *
 * الشكل: `<نطاق>/<معرّف المالك>/<عشوائي>.<امتداد>`
 */
export function buildStorageKey(input: {
  scope: 'attachments' | 'exports' | 'logos';
  ownerId: string;
  contentType: string;
}): string {
  const extension = EXTENSIONS[input.contentType] ?? 'bin';
  const random = randomBytes(16).toString('hex');

  return `${input.scope}/${input.ownerId}/${random}.${extension}`;
}

export { StorageError };
export type { StoragePort, StoredObject, PutObjectInput } from '@/services/storage/ports';
export { UPLOAD_LIMITS, validateUpload, detectContentType } from '@/services/storage/ports';
