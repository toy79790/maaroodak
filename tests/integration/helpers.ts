import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * أدوات اختبارات التكامل — تعمل على PostgreSQL حقيقية (docs/TESTING.md §4).
 *
 * لا محاكاة لقاعدة البيانات: اختلاف السلوك بين المحاكاة والواقع هو مصدر
 * أخطاء الإنتاج، وقاعدتنا تعمل محلياً بأمر واحد.
 */

const url =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@localhost:5433/maroudak_test?schema=public';

export const testDb = new PrismaClient({
  datasources: { db: { url } },
  log: ['error'],
});

let counter = 0;
const unique = () => `${Date.now()}-${(counter += 1)}`;

export interface SeededUser {
  id: string;
  email: string;
}

export async function createUser(
  overrides: { creditBalance?: number; role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN' } = {},
): Promise<SeededUser> {
  const email = `test-${unique()}@example.test`;

  const user = await testDb.user.create({
    data: {
      email,
      name: 'مستخدم اختبار',
      passwordHash: await bcrypt.hash('Test@12345', 4),
      city: 'الرياض',
      phone: '0512345678',
      nationalId: '1012345678',
      creditBalance: overrides.creditBalance ?? 10,
      role: overrides.role ?? 'USER',
    },
    select: { id: true, email: true },
  });

  await testDb.creditTransaction.create({
    data: {
      userId: user.id,
      amount: overrides.creditBalance ?? 10,
      balanceAfter: overrides.creditBalance ?? 10,
      reason: 'SIGNUP_BONUS',
    },
  });

  return user;
}

export interface CatalogFixture {
  departmentId: string;
  requestTypeId: string;
  templateId: string;
}

/**
 * كتالوج مصغّر مستقل عن بيانات البذور.
 * الاختبار الذي يعتمد على البذور ينكسر كلما عُدّلت — وهي بيانات منتج تتغيّر.
 */
export async function createCatalog(): Promise<CatalogFixture> {
  const suffix = unique();

  const department = await testDb.department.create({
    data: {
      slug: `dept-${suffix}`,
      name: 'جهة اختبارية',
      category: 'GOVERNMENT',
      addressee: 'معالي وزير الاختبار',
      honorific: 'معالي',
    },
    select: { id: true },
  });

  const requestType = await testDb.requestType.create({
    data: { slug: `type-${suffix}`, name: 'طلب اختباري' },
    select: { id: true },
  });

  await testDb.departmentRequestType.create({
    data: { departmentId: department.id, requestTypeId: requestType.id },
  });

  const template = await testDb.template.create({
    data: {
      slug: `tpl-${suffix}`,
      name: 'قالب اختباري',
      body: [
        'بسم الله الرحمن الرحيم',
        '',
        '{{department_addressee}}',
        '',
        'الموضوع: {{subject}}',
        '',
        '{{ai_body}}',
        '',
        'مقدّمه لكم / {{full_name}}',
        '{{#if national_id}}رقم الهوية: {{national_id}}{{/if}}',
        'التاريخ: {{today}}',
      ].join('\n'),
      departmentId: department.id,
      requestTypeId: requestType.id,
    },
    select: { id: true },
  });

  // موجّهات لازمة لمسار التوليد.
  await testDb.prompt.createMany({
    data: [
      {
        key: `style-${suffix}`,
        name: 'أسلوب',
        type: 'SYSTEM',
        content: 'اكتب بأسلوب رسمي مختصر.',
      },
      {
        key: `gen-${suffix}`,
        name: 'توليد',
        type: 'GENERATION',
        content: 'اكتب متن المعروض.',
        departmentId: department.id,
        requestTypeId: requestType.id,
      },
      {
        key: `quality-${suffix}`,
        name: 'جودة',
        type: 'QUALITY_CHECK',
        content: 'افحص المعروض.',
      },
    ],
  });

  return {
    departmentId: department.id,
    requestTypeId: requestType.id,
    templateId: template.id,
  };
}

export async function createQuestion(input: {
  key: string;
  label: string;
  type?: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'YES_NO';
  required?: boolean;
  order: number;
  departmentId?: string | null;
  requestTypeId?: string | null;
}): Promise<{ id: string; key: string }> {
  return testDb.question.create({
    data: {
      key: input.key,
      label: input.label,
      type: input.type ?? 'TEXT',
      required: input.required ?? true,
      order: input.order,
      departmentId: input.departmentId ?? null,
      requestTypeId: input.requestTypeId ?? null,
    },
    select: { id: true, key: true },
  });
}

export async function createSession(input: {
  userId: string;
  departmentId: string;
  requestTypeId: string;
  answers: Record<string, unknown>;
}): Promise<string> {
  const session = await testDb.interviewSession.create({
    data: {
      userId: input.userId,
      departmentId: input.departmentId,
      requestTypeId: input.requestTypeId,
      answers: input.answers as never,
    },
    select: { id: true },
  });

  return session.id;
}

/** حذف كل ما أنشأه الاختبار — الترتيب يحترم المفاتيح الأجنبية. */
export async function cleanup(): Promise<void> {
  await testDb.aIUsage.deleteMany({});
  await testDb.letterVersion.deleteMany({});
  await testDb.feedback.deleteMany({});
  await testDb.interviewSession.deleteMany({});
  await testDb.letter.deleteMany({});
  await testDb.creditTransaction.deleteMany({});
  await testDb.analyticsEvent.deleteMany({});
  await testDb.session.deleteMany({});
  await testDb.user.deleteMany({});
  await testDb.questionCondition.deleteMany({});
  await testDb.questionOption.deleteMany({});
  await testDb.question.deleteMany({});
  await testDb.prompt.deleteMany({});
  await testDb.template.deleteMany({});
  await testDb.departmentRequestType.deleteMany({});
  await testDb.department.deleteMany({});
  await testDb.requestType.deleteMany({});
}
