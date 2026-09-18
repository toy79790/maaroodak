import { expect, test } from '@playwright/test';
import { cleanup, createUser, db, login, uid } from './fixtures';

/** لوحة الإدارة: الحماية أولاً، ثم إدارة الكتالوج والموجّهات والإحصائيات. */

test.describe.configure({ mode: 'serial' });
test.afterAll(cleanup);

test('المستخدم العادي لا يدخل لوحة الإدارة ولا واجهاتها', async ({ page }) => {
  // بلا جلسة: تحويل إلى تسجيل الدخول، ورفض من الواجهات.
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);

  const anonymous = await page.request.get('/api/admin/departments');
  expect(anonymous.status()).toBe(401);

  // مستخدم عادي: تحويل من الصفحات ورفض من الواجهات.
  const user = await createUser('USER');
  await login(page, user.email);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard/);

  for (const path of [
    '/api/admin/departments',
    '/api/admin/users',
    '/api/admin/prompts',
    '/api/admin/categories',
  ]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(403);
  }

  const write = await page.request.post('/api/admin/categories', {
    data: { slug: 'e2e-hack', name: 'اختراق', order: 1, isActive: true },
  });
  expect(write.status()).toBe(403);
  expect(await db.departmentCategory.count({ where: { slug: 'e2e-hack' } })).toBe(0);
});

test('المسؤول: فئة ← نوع طلب ← جهة ← تعديل ← سؤال ← موجّه ← إحصائيات', async ({ page }) => {
  const admin = await createUser('SUPER_ADMIN');
  await login(page, admin.email, '/admin');

  const categorySlug = uid('cat');
  const departmentSlug = uid('dept');
  const typeSlug = uid('type');
  const questionKey = `e2e_q_${Date.now().toString(36)}`;
  const promptKey = uid('prompt');

  // --- فئة ---
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'فئة جديدة' }).click();
  await page.getByLabel('الاسم').fill('فئة اختبار آلي');
  await page.getByLabel('المعرّف').fill(categorySlug);
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(page.getByText('تم حفظ الفئة')).toBeVisible();
  const category = await db.departmentCategory.findUniqueOrThrow({ where: { slug: categorySlug } });

  // --- نوع طلب (قبل الجهة ليُربط بها) ---
  await page.goto('/admin/request-types');
  await page.getByRole('button', { name: 'نوع جديد' }).click();
  await page.getByLabel('الاسم').fill('نوع طلب اختبار آلي');
  await page.getByLabel('المعرّف').fill(typeSlug);
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await expect(page.getByText('تم حفظ نوع الطلب')).toBeVisible();

  // --- جهة ---
  await page.goto('/admin/departments/new');
  await page.getByLabel('اسم الجهة').fill('جهة اختبار آلي');
  await page.getByLabel('المعرّف').fill(departmentSlug);
  await page.getByLabel('الفئة').selectOption(category.id);
  await page.getByLabel('سطر المخاطبة').fill('سعادة مدير جهة الاختبار');
  await page.getByPlaceholder('ابحث في أنواع الطلبات…').fill('نوع طلب اختبار آلي');
  await page.getByText('نوع طلب اختبار آلي', { exact: true }).click();
  await page.getByRole('button', { name: 'إنشاء الجهة' }).click();
  await expect(page).toHaveURL(/\/admin\/departments$/);

  const department = await db.department.findFirstOrThrow({
    where: { slug: departmentSlug },
    select: {
      id: true,
      categoryId: true,
      requestTypes: { select: { requestType: { select: { slug: true } } } },
    },
  });
  expect(department.categoryId).toBe(category.id);
  expect(department.requestTypes.map((link) => link.requestType.slug)).toEqual([typeSlug]);

  // --- تعديل الجهة ---
  await page.goto(`/admin/departments/${department.id}`);
  await page.getByLabel('اسم الجهة').fill('جهة اختبار آلي — معدّلة');
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await expect(page.getByRole('link', { name: 'جهة اختبار آلي — معدّلة', exact: true })).toBeVisible();

  // الفئة غير الفارغة لا تُحذف.
  const blocked = await page.request.delete(`/api/admin/categories/${category.id}`);
  expect(blocked.status()).toBe(409);

  // --- سؤال مرتبط بالجهة ---
  await page.goto('/admin/questions/new');
  await page.getByLabel('نص السؤال').fill('ما رقم ملفك لدى الجهة؟');
  await page.getByLabel('المفتاح').fill(questionKey);
  await page.getByLabel('الجهة').selectOption(department.id);
  await page.getByRole('button', { name: /حفظ|إنشاء/ }).last().click();
  await expect(page).toHaveURL(/\/admin\/questions$/);
  const question = await db.question.findFirstOrThrow({ where: { key: questionKey } });
  expect(question.departmentId).toBe(department.id);

  // --- موجّه: إنشاء ثم تعديل ---
  await page.goto('/admin/prompts/new');
  await page.getByLabel('الاسم').fill('موجّه اختبار آلي');
  await page.getByLabel('المفتاح').fill(promptKey);
  await page.getByLabel('النوع').selectOption('GENERATION');
  await page.getByLabel('الجهة').selectOption(department.id);
  await page.getByLabel('النص').fill('اكتب متن معروض رسمي مختصر من الحقائق المقدّمة فقط.');
  await page.getByRole('button', { name: 'إنشاء الموجّه' }).click();
  // الرابط يطابق /admin/prompts/new نفسه، فالشاهد الصحيح هو القاعدة لا الرابط.
  await expect
    .poll(async () => db.prompt.count({ where: { key: promptKey } }), { timeout: 30_000 })
    .toBe(1);
  await expect(page).not.toHaveURL(/\/new$/);

  const prompt = await db.prompt.findFirstOrThrow({ where: { key: promptKey } });
  expect(prompt.departmentId).toBe(department.id);
  await page.goto(`/admin/prompts/${prompt.id}`);
  await page.getByLabel('النص').fill('اكتب متن معروض رسمي مختصر جداً من الحقائق المقدّمة فقط.');
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(page.getByText('تم حفظ الموجّه')).toBeVisible();
  await expect
    .poll(async () => (await db.prompt.findUniqueOrThrow({ where: { id: prompt.id } })).content)
    .toContain('مختصر جداً');

  // --- الإحصائيات والمستخدمون والمعاريض ---
  for (const path of ['/admin', '/admin/analytics', '/admin/users', '/admin/letters', '/admin/audit-logs']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('main')).not.toContainText('حدث خطأ غير متوقع');
  }

  // سجل التدقيق سجّل عمليات هذه الجلسة.
  const audited = await db.auditLog.count({
    where: {
      actorId: admin.id,
      action: { in: ['category.create', 'department.create', 'department.update'] },
    },
  });
  expect(audited).toBe(3);
});
