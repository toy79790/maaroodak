import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    // اختبارات المكوّنات تُعلن بيئتها بتعليق: /** @vitest-environment jsdom */
    // اختبارات التكامل تشترك في قاعدة بيانات واحدة، فتشغيلها بالتوازي
    // يجعل تنظيف إحداها يمسح بيانات الأخرى.
    fileParallelism: false,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/services/**', 'src/lib/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
      '~/prisma': resolve(process.cwd(), 'prisma'),
      /*
       * `server-only` حارس وقت البناء في Next.js يرمي عند استيراده خارج
       * مكوّن خادم. في Vitest لا يوجد هذا التمييز أصلاً — كل شيء يعمل على
       * Node — فنستبدله بوحدة فارغة بدل حذف الحارس من شيفرة الإنتاج.
       */
      'server-only': resolve(process.cwd(), 'tests/stubs/server-only.ts'),
    },
  },
});
