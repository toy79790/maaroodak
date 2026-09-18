import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, cleanup, createLetter, createUser, db, login, uid } from './fixtures';

/**
 * رحلة المستخدم: تسجيل ← جهة ← نوع ← أسئلة ← مراجعة ← توليد ← معروض:
 * تعديل · نسخ · طباعة · Word · حفظ.
 */

test.describe.configure({ mode: 'serial' });
test.afterAll(cleanup);

/** إجابات صالحة لأسئلة «وزارة الموارد البشرية × طلب مساعدة مالية». */
const TEXT_ANSWERS: Record<string, string> = {
  full_name: 'عبدالله بن سعد القحطاني',
  phone: '0551234567',
  city: 'الرياض',
  request_summary:
    'أعول أسرة من خمسة أفراد، وتوقف دخلي الشهري منذ ستة أشهر بعد انتهاء عقد عملي، وتراكمت علي أقساط الإيجار.',
  monthly_income: '3000',
  family_members: '5',
  requested_amount: '15000',
};

const RADIO_ANSWERS: Record<string, string> = {
  applicant_type: 'individual',
  need_reason: 'job_loss',
};

async function answerCurrentStep(page: Page) {
  for (const [key, value] of Object.entries(TEXT_ANSWERS)) {
    const field = page.locator(`#q-${key}`);
    if ((await field.count()) > 0 && (await field.inputValue()) === '') await field.fill(value);
  }
  for (const value of Object.values(RADIO_ANSWERS)) {
    const radio = page.locator(`input[type="radio"][value="${value}"]`);
    if ((await radio.count()) > 0) await radio.check({ force: true });
  }
}

test('إنشاء حساب ثم المقابلة كاملة حتى التوليد', async ({ page, request }) => {
  const email = `${uid('register')}@example.test`;

  // --- التسجيل ---
  await page.goto('/register');
  await page.getByLabel('الاسم الكامل').fill('مستخدم رحلة كاملة');
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const user = await db.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, creditBalance: true, role: true },
  });
  expect(user.role).toBe('USER');

  // --- اختيار الجهة ثم النوع ---
  await page.goto('/new');
  await page.getByRole('button', { name: /وزارة الموارد البشرية والتنمية الاجتماعية/ }).click();
  await expect(page.getByRole('heading', { name: 'ما نوع طلبك؟' })).toBeVisible();
  await page.getByRole('button', { name: /طلب مساعدة مالية/ }).click();
  await expect(page).toHaveURL(/\/new\/[a-z0-9]+$/);

  // --- الأسئلة: خطوة خطوة حتى شاشة المراجعة ---
  const review = page.getByRole('heading', { name: 'راجع معلوماتك' });
  const progressText = page.getByText(/^السؤال .+ من .+$/);

  for (let step = 0; step < 20 && !(await review.isVisible()); step += 1) {
    const before = await progressText.textContent();
    await answerCurrentStep(page);
    await page.getByRole('button', { name: /^(التالي|مراجعة)$/ }).click();
    await expect(async () => {
      if (await review.isVisible()) return;
      expect(await progressText.textContent()).not.toBe(before);
    }).toPass({ timeout: 20_000 });
  }
  await expect(review).toBeVisible();

  // الإجابات محفوظة على الخادم لا في المتصفح فقط.
  const session = await db.interviewSession.findFirstOrThrow({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { answers: true },
  });
  expect(session.answers).toMatchObject({ full_name: TEXT_ANSWERS.full_name, city: 'الرياض' });

  // --- التوليد ---
  const health = await (await request.get('/api/health')).json();
  await page.getByRole('button', { name: 'أنشئ المعروض' }).click();

  if (health.checks.ai.status === 'ok') {
    await expect(page).toHaveURL(/\/letters\/[a-z0-9]+$/, { timeout: 120_000 });
  } else {
    // بلا مفتاح: رسالة واضحة، ولا يُخصم رصيد على عملية لم تتم.
    await expect(page.getByText('خدمة الذكاء الاصطناعي غير مُهيّأة حالياً.')).toBeVisible();
    const after = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    expect(after.creditBalance).toBe(user.creditBalance);
  }
});

test('المعروض: نسخ · طباعة · Word · تعديل وحفظ · مفضلة', async ({ page, context }) => {
  const user = await createUser();
  const letter = await createLetter(user.id);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await login(page, user.email, `/letters/${letter.id}`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('e2e — طلب مساعدة مالية');

  // --- نسخ النص ---
  await page.getByRole('button', { name: 'نسخ النص' }).click();
  await expect(page.getByText('نُسخ نص المعروض')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('أتقدم إلى معاليكم بطلب مساعدة مالية.');
  expect(copied).not.toContain('<p>');

  // --- الطباعة (PDF) — نعترض النداء بدل فتح نافذة النظام ---
  await page.evaluate(() => {
    const w = window as unknown as { __printed: boolean };
    w.__printed = false;
    window.print = () => {
      w.__printed = true;
    };
  });
  await page.getByRole('button', { name: 'طباعة / PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: boolean }).__printed)).toBe(
    true,
  );

  // --- Word ---
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Word' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.docx$/);

  // --- تعديل ثم حفظ: نسخة جديدة في القاعدة ---
  await page.getByRole('tab', { name: 'تحرير' }).click();
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' وأرفقت ما يثبت ذلك.');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByText('تم حفظ التعديلات')).toBeVisible();

  const saved = await db.letter.findUniqueOrThrow({
    where: { id: letter.id },
    select: { currentVersion: true, contentText: true },
  });
  expect(saved.currentVersion).toBe(2);
  expect(saved.contentText).toContain('وأرفقت ما يثبت ذلك.');

  // --- المفضلة ---
  await page.getByRole('button', { name: 'إضافة للمفضلة' }).click();
  await expect(page.getByRole('button', { name: 'إزالة من المفضلة' })).toBeVisible();
});

test('لا يفتح مستخدمٌ معروضَ غيره', async ({ page }) => {
  const owner = await createUser();
  const letter = await createLetter(owner.id);
  const stranger = await createUser();

  await login(page, stranger.email);
  const response = await page.goto(`/letters/${letter.id}`);
  expect(response?.status()).toBe(404);

  const api = await page.request.get(`/api/letters/${letter.id}`);
  expect(api.status()).toBe(404);
});
