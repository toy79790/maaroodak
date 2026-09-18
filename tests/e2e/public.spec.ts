import { expect, test } from '@playwright/test';

/**
 * الصفحات العامة: تفتح، تحمل عنوانها ورابطها المعياري ووصفها، بلا أخطاء
 * في الطرفية، وروابطها الداخلية سليمة.
 */

const PAGES = [
  { path: '/', h1: /اكتب معروضك/ },
  { path: '/about', h1: /عن معروضي/ },
  { path: '/contact', h1: /تواصل معنا/ },
  { path: '/faq', h1: /الأسئلة الشائعة/ },
  { path: '/departments', h1: /الجهات المدعومة/ },
  { path: '/request-types', h1: /أنواع المعاريض/ },
  { path: '/privacy', h1: /سياسة الخصوصية/ },
  { path: '/terms', h1: /شروط الاستخدام/ },
  { path: '/ai-disclaimer', h1: /إخلاء مسؤولية/ },
];

for (const { path, h1 } of PAGES) {
  test(`الصفحة ${path} تعمل ومهيّأة لمحركات البحث`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    await expect(page).toHaveTitle(/معروضي/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', new RegExp(`${path === '/' ? '' : path}$`));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('الجهات وأنواع المعاريض تُقرأ من قاعدة البيانات', async ({ page }) => {
  await page.goto('/departments');
  await expect(page.getByRole('heading', { name: 'جهات حكومية' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الديوان الملكي' })).toBeVisible();

  await page.goto('/request-types');
  await expect(page.getByRole('heading', { name: 'طلب مساعدة مالية' })).toBeVisible();
});

test('صفحة 404 عربية وبرمز 404', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('body')).toContainText(/غير موجودة|لم نجد/);
});

test('خريطة الموقع وrobots.txt', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const path of ['/departments', '/request-types', '/faq', '/about', '/contact']) {
    expect(xml).toContain(`${path}</loc>`);
  }

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Sitemap:');
});

test('روابط الترويسة والتذييل لا تؤدي إلى 404', async ({ page, request }) => {
  await page.goto('/about');
  const hrefs = await page
    .locator('header a[href^="/"], footer a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href') ?? ''))]);

  expect(hrefs.length).toBeGreaterThan(8);

  for (const href of hrefs) {
    const path = href.split('#')[0] || '/';
    const response = await request.get(path, { maxRedirects: 0 });
    // الصفحات المحمية تحوّل إلى تسجيل الدخول (307) — وهذا سلوك صحيح.
    expect([200, 307], `${href} → ${response.status()}`).toContain(response.status());
  }
});

test('الفحص الصحي لا يكشف أسراراً', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).not.toMatch(/postgres(ql)?:\/\/|sk-ant|password/i);
  expect(JSON.parse(body).checks).toHaveProperty('mail');
});
