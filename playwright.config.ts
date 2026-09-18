import { defineConfig, devices } from '@playwright/test';

/**
 * اختبارات المتصفح (E2E) — docs/TESTING.md §5
 *
 * تعمل على خادم تطوير حقيقي وقاعدة التطوير المحلية (`npm run db:start` ثم
 * البذور). كل ما تُنشئه يحمل البادئة `e2e-` ويُحذف في نهايتها.
 *
 * المتصفح: Edge المثبّت على ويندوز افتراضياً — لا تنزيل ~150 ميجا لمتصفحات
 * Playwright. على لينكس/CI: `npx playwright install chromium` واضبط
 * `E2E_BROWSER_CHANNEL=chromium`.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
const channel =
  process.env.E2E_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium');

export default defineConfig({
  testDir: 'tests/e2e',
  // تسلسلي: قاعدة واحدة، وحدود معدّل في ذاكرة خادم واحد.
  workers: 1,
  fullyParallel: false,
  // خادم التطوير يُترجم الصفحة عند أول طلب — مهلات سخية.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'ar-SA',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], channel },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
