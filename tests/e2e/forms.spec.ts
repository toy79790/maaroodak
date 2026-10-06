import { expect, test } from '@playwright/test';

/**
 * النماذج قبل hydration — DECISIONS.md #D-049.
 *
 * بلا JavaScript نرى HTML الخادم كما يراه مستخدم ضغط Enter قبل اكتمال
 * التحميل. حدث فعلاً: نموذج الدخول أُرسل بـ GET فظهرت كلمة المرور في الرابط.
 */

const SENSITIVE_FORMS = ['/login', '/register', '/forgot-password'];

test.describe('بلا JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of SENSITIVE_FORMS) {
    test(`نموذج ${path} يُرسَل بـ POST وزرّه معطّل`, async ({ page }) => {
      await page.goto(path);
      const form = page.locator('form');
      await expect(form).toHaveAttribute('method', 'post');
      await expect(form.locator('button[type="submit"]')).toBeDisabled();
    });
  }

  test('Enter في نموذج الدخول لا يضع كلمة المرور في الرابط', async ({ page }) => {
    await page.goto('/login?next=%2Fadmin');
    await page.getByLabel('البريد الإلكتروني').fill('e2e-leak@example.test');
    await page.locator('#password').fill('e2e-secret-value');
    await page.locator('#password').press('Enter');

    await page.waitForLoadState('load');
    expect(page.url()).not.toContain('e2e-secret-value');
    expect(page.url()).not.toContain('password=');
  });
});

test('زرّ الإرسال يُفعَّل بعد التحميل', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled();
});
