import { expect, test } from '@playwright/test';

/** الجوال: لا تمرير أفقي، والقائمة تفتح وتنقل. */

const PATHS = ['/', '/about', '/contact', '/faq', '/departments', '/request-types', '/login', '/register'];

for (const path of PATHS) {
  test(`${path} بلا تمرير أفقي على الجوال`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('قائمة الجوال تفتح وتنقل إلى الأسئلة الشائعة', async ({ page }) => {
  await page.goto('/about');
  await page.getByRole('button', { name: 'فتح القائمة' }).click();
  await page.getByRole('navigation', { name: 'تنقل الجوال' }).getByRole('link', { name: 'الأسئلة الشائعة' }).click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('الأسئلة الشائعة');
});
