import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { expect, type Page } from '@playwright/test';

/**
 * بيانات اختبارات المتصفح — تُنشأ مباشرة في قاعدة التطوير وتُحذف بعدها.
 *
 * البادئة `e2e-` في كل بريد ومعرّف هي ما يسمح بالتنظيف الآمن: لا يُحذف
 * سجلّ لم تُنشئه هذه الاختبارات.
 */

export const db = new PrismaClient({ log: ['error'] });

export const PASSWORD = 'E2e!Strong-Pass-2026';

const RUN = Date.now().toString(36);
let counter = 0;
export const uid = (label: string) => `e2e-${label}-${RUN}-${(counter += 1)}`;

export async function createUser(role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' = 'USER') {
  const email = `${uid(role.toLowerCase())}@example.test`;
  const user = await db.user.create({
    data: {
      email,
      name: role === 'USER' ? 'مستخدم تجريبي' : 'مسؤول تجريبي',
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role,
      creditBalance: 10,
    },
    select: { id: true, email: true },
  });
  return user;
}

export async function login(page: Page, email: string, next = '/dashboard') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('البريد الإلكتروني').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, '\/')}`));
}

/** معروض جاهز لمستخدم — مسار التوليد نفسه يحتاج مفتاح AI (انظر user-journey). */
export async function createLetter(userId: string) {
  const [department, requestType] = await Promise.all([
    db.department.findFirstOrThrow({ where: { slug: 'ministry-hrsd' }, select: { id: true } }),
    db.requestType.findFirstOrThrow({ where: { slug: 'financial-aid' }, select: { id: true } }),
  ]);

  const contentHtml =
    '<p>بسم الله الرحمن الرحيم</p><p>معالي وزير الموارد البشرية والتنمية الاجتماعية حفظه الله</p><p>أتقدم إلى معاليكم بطلب مساعدة مالية.</p>';

  return db.letter.create({
    data: {
      title: 'e2e — طلب مساعدة مالية',
      subject: 'طلب مساعدة مالية',
      contentHtml,
      contentText: 'بسم الله الرحمن الرحيم\n\nمعالي وزير الموارد البشرية والتنمية الاجتماعية حفظه الله\n\nأتقدم إلى معاليكم بطلب مساعدة مالية.',
      userId,
      departmentId: department.id,
      requestTypeId: requestType.id,
      status: 'GENERATED',
      versions: {
        create: { version: 1, title: 'e2e — طلب مساعدة مالية', contentHtml, source: 'AI_GENERATED' },
      },
    },
    select: { id: true },
  });
}

/** يحذف كل ما يحمل البادئة `e2e-` — بترتيب يحترم المفاتيح الأجنبية. */
export async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { startsWith: 'e2e-' } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length > 0) {
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.aIUsage.deleteMany({ where: { userId: { in: userIds } } });
    await db.analyticsEvent.deleteMany({ where: { userId: { in: userIds } } });
    await db.interviewSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.letter.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await db.prompt.deleteMany({ where: { key: { startsWith: 'e2e-' } } });
  await db.question.deleteMany({ where: { key: { startsWith: 'e2e_' } } });
  await db.department.deleteMany({ where: { slug: { startsWith: 'e2e-' } } });
  await db.requestType.deleteMany({ where: { slug: { startsWith: 'e2e-' } } });
  await db.departmentCategory.deleteMany({ where: { slug: { startsWith: 'e2e-' } } });
}
