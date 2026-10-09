import { expect, test, type Page } from '@playwright/test';
import { cleanup, createLetter, createUser, login } from './fixtures';

/** الجوال: لا تمرير أفقي، والقائمة تفتح وتنقل، وورقة المعروض كاملة. */

test.afterAll(cleanup);

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

/** موضع الورقة وتكبيرها — ما يراه المستخدم فعلاً لا ما تقوله الأنماط. */
function paperMetrics(page: Page) {
  return page.evaluate(() => {
    const paper = document.querySelector<HTMLElement>('.letter-paper')!;
    const box = paper.getBoundingClientRect();
    const container = paper.parentElement!;
    return {
      left: box.left,
      right: box.right,
      viewport: document.documentElement.clientWidth,
      containerOverflow: container.scrollWidth - container.clientWidth,
      zoom: Number(getComputedStyle(paper).zoom),
    };
  });
}

// #D-050: كان التصغير ثابتاً (0.62) فتُقصّ بداية الأسطر على شاشة الجوال.
test('ورقة المعروض كاملة على الجوال، وتتكيّف مع العرض، وتُطبع بحجمها', async ({ page }) => {
  const user = await createUser();
  const letter = await createLetter(user.id);
  await login(page, user.email, `/letters/${letter.id}`);
  await expect(page.locator('.letter-paper')).toBeVisible();

  const narrow = await paperMetrics(page);
  expect(narrow.left).toBeGreaterThanOrEqual(0);
  expect(narrow.right).toBeLessThanOrEqual(narrow.viewport);
  expect(narrow.containerOverflow).toBeLessThanOrEqual(1);
  expect(narrow.zoom).toBeLessThan(1);

  // تدوير الجهاز أو توسيع النافذة: الورقة تكبر دون إعادة تحميل.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => (await paperMetrics(page)).zoom).toBeGreaterThan(narrow.zoom);
  const wide = await paperMetrics(page);
  expect(wide.right).toBeLessThanOrEqual(wide.viewport);
  expect(wide.containerOverflow).toBeLessThanOrEqual(1);

  // الطباعة/PDF بمقاس A4 الحقيقي لا بمقاس الشاشة.
  await page.emulateMedia({ media: 'print' });
  expect((await paperMetrics(page)).zoom).toBe(1);
});

// #D-053: الشريط كان داخل نموذج بـtransform (حركة الدخول) فلا يثبت أسفل الشاشة.
test('شريط «التالي» في المقابلة ثابت أسفل الشاشة على الجوال', async ({ page }) => {
  const user = await createUser();
  await login(page, user.email, '/new');
  await page.getByRole('button', { name: /وزارة الموارد البشرية والتنمية الاجتماعية/ }).click();
  await page.getByRole('button', { name: /طلب مساعدة مالية/ }).click();
  await expect(page).toHaveURL(/\/new\/[a-z0-9]+$/);

  const next = page.getByRole('button', { name: /^(التالي|مراجعة)$/ });
  await expect(next).toBeVisible();
  // ننتظر انتهاء حركة الدخول — الخطأ كان يظهر بعدها لا أثناءها.
  await page.waitForTimeout(500);

  const viewport = page.viewportSize()!;
  const pinned = async () => {
    const box = (await next.boundingBox())!;
    return { bottom: box.y + box.height, width: box.width };
  };

  const first = await pinned();
  expect(first.bottom).toBeLessThanOrEqual(viewport.height);
  expect(first.bottom).toBeGreaterThan(viewport.height - 100);

  // يبقى في مكانه مهما طال المحتوى فوقه.
  await page.mouse.wheel(0, 2000);
  expect((await pinned()).bottom).toBeCloseTo(first.bottom, 0);
});
