import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `APP_ENV` إلزامي في وضع الإنتاج — #D-048
 *
 * بلا هذا الحارس كان خادم إنتاج نُسي في بيئته `APP_ENV` يُقلع كبيئة تطوير
 * بصمت، ومسار الاستعادة يُرجع رابط إعادة التعيين في الرد لأي زائر.
 */

async function loadEnv() {
  vi.resetModules();
  return import('@/config/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('APP_ENV في وضع الإنتاج', () => {
  it('يرفض الإقلاع بلا APP_ENV صريح', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', undefined);
    vi.stubEnv('NEXT_PHASE', '');

    await expect(loadEnv()).rejects.toThrow('APP_ENV');
  });

  it('يسمح بـ development صريحاً (next start محلياً)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('NEXT_PHASE', '');

    const env = await loadEnv();
    expect(env.isDevelopment).toBe(true);
  });

  it('لا يتدخّل وقت البناء — Next.js يضبط NODE_ENV=production فيه', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', undefined);
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');

    await expect(loadEnv()).resolves.toBeDefined();
  });

  it('خارج الإنتاج يبقى الافتراضي development', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_ENV', undefined);

    const env = await loadEnv();
    expect(env.appEnv).toBe('development');
  });
});
