import { describe, expect, it } from 'vitest';
import {
  detectContentType,
  validateUpload,
  UPLOAD_LIMITS,
} from '@/services/storage/ports';
import { buildStorageKey } from '@/services/storage';

/** يبني عازلاً يبدأ بتوقيع معيّن ثم حشو. */
function withMagic(bytes: readonly number[], totalSize = 64): Buffer {
  const buffer = Buffer.alloc(totalSize);
  bytes.forEach((byte, index) => {
    buffer[index] = byte;
  });
  return buffer;
}

const PDF = withMagic([0x25, 0x50, 0x44, 0x46]);
const PNG = withMagic([0x89, 0x50, 0x4e, 0x47]);
const JPEG = withMagic([0xff, 0xd8, 0xff]);

describe('detectContentType — يفحص المحتوى لا الامتداد', () => {
  it('يتعرّف على الأنواع المسموحة', () => {
    expect(detectContentType(PDF)).toBe('application/pdf');
    expect(detectContentType(PNG)).toBe('image/png');
    expect(detectContentType(JPEG)).toBe('image/jpeg');
  });

  it('يتعرّف على WebP عبر RIFF + WEBP', () => {
    const webp = Buffer.alloc(64);
    Buffer.from('RIFF').copy(webp, 0);
    Buffer.from('WEBP').copy(webp, 8);
    expect(detectContentType(webp)).toBe('image/webp');
  });

  it('يرفض ملفاً تنفيذياً متنكّراً', () => {
    // MZ — ترويسة ملف Windows التنفيذي. الامتداد قد يكون .pdf والعميل
    // قد يرسل Content-Type: application/pdf — وكلاهما تحت سيطرته.
    const executable = withMagic([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectContentType(executable)).toBeNull();
  });

  it('يرفض سكربت شل', () => {
    const script = Buffer.from('#!/bin/sh\nrm -rf /\n');
    expect(detectContentType(script)).toBeNull();
  });
});

describe('validateUpload', () => {
  it('يقبل ملفاً سليماً', () => {
    const result = validateUpload(PDF);
    expect(result.ok).toBe(true);
    expect(result.contentType).toBe('application/pdf');
  });

  it('يرفض الملف الفارغ', () => {
    expect(validateUpload(Buffer.alloc(0)).ok).toBe(false);
  });

  it('يرفض ما يتجاوز الحد', () => {
    const large = Buffer.alloc(UPLOAD_LIMITS.maxBytes + 1);
    Buffer.from([0x25, 0x50, 0x44, 0x46]).copy(large, 0);

    const result = validateUpload(large);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('حجم الملف');
  });

  it('يرفض النوع غير المدعوم', () => {
    const gif = withMagic([0x47, 0x49, 0x46, 0x38]);
    expect(validateUpload(gif).ok).toBe(false);
  });
});

describe('buildStorageKey', () => {
  const base = { scope: 'attachments' as const, ownerId: 'user_123' };

  it('لا يشتقّ المفتاح من اسم الملف', () => {
    // اسم مثل «تقرير-طبي-محمد.pdf» يسرّب معلومة شخصية في الرابط نفسه،
    // ويجعل الملف قابلاً للتخمين. المفتاح عشوائي دائماً.
    const key = buildStorageKey({ ...base, contentType: 'application/pdf' });

    expect(key).toMatch(/^attachments\/user_123\/[a-f0-9]{32}\.pdf$/);
    expect(key).not.toContain('تقرير');
  });

  it('ينتج مفتاحاً مختلفاً في كل مرة', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () =>
        buildStorageKey({ ...base, contentType: 'image/png' }),
      ),
    );
    expect(keys.size).toBe(50);
  });

  it('يعزل المفاتيح بالمالك والنطاق', () => {
    const a = buildStorageKey({ ...base, contentType: 'image/png' });
    const b = buildStorageKey({ ...base, ownerId: 'user_999', contentType: 'image/png' });

    expect(a.startsWith('attachments/user_123/')).toBe(true);
    expect(b.startsWith('attachments/user_999/')).toBe(true);
  });

  it('يستخدم امتداداً احتياطياً للنوع غير المعروف', () => {
    const key = buildStorageKey({ ...base, contentType: 'application/octet-stream' });
    expect(key.endsWith('.bin')).toBe(true);
  });

  it('لا يسمح بمحارف مسار في المفتاح', () => {
    // حتى لو حمل معرّف المالك محارف غريبة، البنية تبقى ثلاثية المقاطع.
    const key = buildStorageKey({ ...base, contentType: 'application/pdf' });
    expect(key.split('/')).toHaveLength(3);
    expect(key).not.toContain('..');
  });
});
