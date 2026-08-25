import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEPARTMENTS } from './seed-data/departments';
import { REQUEST_TYPES } from './seed-data/request-types';
import { QUESTIONS, type QuestionSeed } from './seed-data/questions';
import { TEMPLATES } from './seed-data/templates';
import { PROMPTS } from './seed-data/prompts';
import { PLANS, SYSTEM_SETTINGS } from './seed-data/plans';

/**
 * بذر البيانات — docs/DATABASE.md §7
 *
 * متكرّر الأمان (idempotent): كل عملية `upsert` على مفتاح طبيعي، فتشغيله
 * مرتين لا يُنشئ تكراراً ولا يُتلف بيانات موجودة. هذا شرط لتشغيله على
 * قاعدة فيها معاريض مستخدمين حقيقية عند إضافة جهة جديدة.
 */

const prisma = new PrismaClient();

const log = (message: string) => console.log(`  ${message}`);

/**
 * سجلات النظام تحمل `organizationId = null`، و PostgreSQL يعتبر كل NULL
 * مميّزاً عن الآخر — فقيد `@@unique([slug, organizationId])` **لا يمنع**
 * تكرار سجلات النظام، و Prisma لا يقبل null في `where` المركّب أصلاً.
 *
 * الحل من شقّين:
 *  1. فهرس فريد جزئي يفرض التفرّد فعلياً — يُنشئه الترحيل
 *     `20260825000100_system_indexes`، لا هذا الملف. البذور تُدخل بيانات
 *     ولا تُغيّر بنية المخطط؛ خلط الأمرين يجعل حالة القاعدة تعتمد على
 *     تشغيل البذور وهي عملية اختيارية.
 *  2. `upsertSystemRecord` أدناه يبحث ثم ينشئ/يحدّث بدل `upsert`.
 */

/** بحث ثم إنشاء/تحديث — بديل `upsert` لسجلات النظام. */
async function upsertSystemRecord<TCreate, TUpdate>(
  model: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<{ id: string }>;
  },
  where: Record<string, unknown>,
  create: TCreate,
  update: TUpdate,
): Promise<string> {
  const existing = await model.findFirst({
    where: { ...where, organizationId: null },
    select: { id: true },
  });

  const record = existing
    ? await model.update({ where: { id: existing.id }, data: update, select: { id: true } })
    : await model.create({ data: create, select: { id: true } });

  return record.id;
}

/* ==========================================================================
   الجهات وأنواع الطلبات
   ========================================================================== */

async function seedRequestTypes(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const seed of REQUEST_TYPES) {
    const id = await upsertSystemRecord(
      prisma.requestType,
      { slug: seed.slug },
      {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        order: seed.order,
      },
      {
        name: seed.name,
        description: seed.description,
        icon: seed.icon,
        order: seed.order,
        isActive: true,
        deletedAt: null,
      },
    );
    ids.set(seed.slug, id);
  }

  log(`✓ ${ids.size} نوع طلب`);
  return ids;
}

async function seedDepartments(
  requestTypeIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let links = 0;

  for (const seed of DEPARTMENTS) {
    const departmentId = await upsertSystemRecord(
      prisma.department,
      { slug: seed.slug },
      {
        slug: seed.slug,
        name: seed.name,
        nameEn: seed.nameEn ?? null,
        category: seed.category,
        description: seed.description,
        honorific: seed.honorific,
        addressee: seed.addressee,
        order: seed.order,
      },
      {
        name: seed.name,
        nameEn: seed.nameEn ?? null,
        category: seed.category,
        description: seed.description,
        honorific: seed.honorific,
        addressee: seed.addressee,
        order: seed.order,
        isActive: true,
        deletedAt: null,
      },
    );

    ids.set(seed.slug, departmentId);

    // أنواع الطلبات المتاحة لهذه الجهة — مصدر «تختلف الخيارات حسب الجهة».
    for (const [index, typeSlug] of [...new Set(seed.requestTypes)].entries()) {
      const requestTypeId = requestTypeIds.get(typeSlug);
      if (!requestTypeId) {
        console.warn(`  ⚠ نوع طلب غير معروف "${typeSlug}" في جهة "${seed.slug}"`);
        continue;
      }

      await prisma.departmentRequestType.upsert({
        where: {
          departmentId_requestTypeId: { departmentId, requestTypeId },
        },
        create: { departmentId, requestTypeId, order: index },
        update: { order: index, isActive: true },
      });
      links += 1;
    }
  }

  log(`✓ ${ids.size} جهة · ${links} ربط جهة×نوع`);
  return ids;
}

/* ==========================================================================
   الأسئلة والشروط
   ========================================================================== */

/**
 * مفتاح فريد للسؤال ضمن نطاقه.
 * لا يمكن استخدام `key` وحده لأن نفس المفتاح قد يُعرّف بنطاقات مختلفة.
 */
function scopeKey(seed: QuestionSeed): string {
  return `${seed.key}|${seed.department ?? '*'}|${seed.requestType ?? '*'}`;
}

async function seedQuestions(
  departmentIds: Map<string, string>,
  requestTypeIds: Map<string, string>,
): Promise<void> {
  const idsByScope = new Map<string, string>();
  let optionCount = 0;

  for (const seed of QUESTIONS) {
    const departmentId = seed.department
      ? (departmentIds.get(seed.department) ?? null)
      : null;
    const requestTypeId = seed.requestType
      ? (requestTypeIds.get(seed.requestType) ?? null)
      : null;

    if (seed.department && !departmentId) {
      console.warn(`  ⚠ جهة غير معروفة "${seed.department}" للسؤال "${seed.key}"`);
      continue;
    }
    if (seed.requestType && !requestTypeId) {
      console.warn(`  ⚠ نوع غير معروف "${seed.requestType}" للسؤال "${seed.key}"`);
      continue;
    }

    const data = {
      key: seed.key,
      label: seed.label,
      description: seed.description ?? null,
      type: seed.type,
      required: seed.required ?? true,
      placeholder: seed.placeholder ?? null,
      helpText: seed.helpText ?? null,
      groupKey: seed.groupKey ?? null,
      order: seed.order,
      aiHint: seed.aiHint ?? null,
      validation: (seed.validation ?? null) as Prisma.InputJsonValue,
      departmentId,
      requestTypeId,
    };

    // لا مفتاح فريد مركّب على Question (النطاق يحتوي null)، فنبحث ثم ننشئ/نحدّث.
    const existing = await prisma.question.findFirst({
      where: {
        key: seed.key,
        departmentId,
        requestTypeId,
        organizationId: null,
      },
      select: { id: true },
    });

    const record = existing
      ? await prisma.question.update({
          where: { id: existing.id },
          data: { ...data, isActive: true, deletedAt: null },
          select: { id: true },
        })
      : await prisma.question.create({ data, select: { id: true } });

    idsByScope.set(scopeKey(seed), record.id);

    // الخيارات: نستبدلها بالكامل لضمان مطابقة البذور.
    if (seed.options && seed.options.length > 0) {
      await prisma.questionOption.deleteMany({ where: { questionId: record.id } });
      await prisma.questionOption.createMany({
        data: seed.options.map((option, index) => ({
          questionId: record.id,
          value: option.value,
          label: option.label,
          order: index,
        })),
      });
      optionCount += seed.options.length;
    }
  }

  log(`✓ ${idsByScope.size} سؤال · ${optionCount} خيار`);

  await seedConditions(idsByScope);
}

async function seedConditions(idsByScope: Map<string, string>): Promise<void> {
  let count = 0;

  for (const seed of QUESTIONS) {
    if (!seed.conditions || seed.conditions.length === 0) continue;

    const questionId = idsByScope.get(scopeKey(seed));
    if (!questionId) continue;

    // استبدال كامل: البذور هي مصدر الحقيقة لقواعد النظام.
    await prisma.questionCondition.deleteMany({
      where: { targetQuestionId: questionId },
    });

    for (const [index, condition] of seed.conditions.entries()) {
      await prisma.questionCondition.create({
        data: {
          targetQuestionId: questionId,
          action: condition.action ?? 'SHOW',
          logic: condition.logic ?? 'AND',
          clauses: condition.clauses as unknown as Prisma.InputJsonValue,
          order: index,
        },
      });
      count += 1;
    }
  }

  log(`✓ ${count} قاعدة شرطية`);
}

/* ==========================================================================
   القوالب والموجّهات
   ========================================================================== */

async function seedTemplates(
  departmentIds: Map<string, string>,
  requestTypeIds: Map<string, string>,
): Promise<void> {
  for (const seed of TEMPLATES) {
    const departmentId = seed.department
      ? (departmentIds.get(seed.department) ?? null)
      : null;
    const requestTypeId = seed.requestType
      ? (requestTypeIds.get(seed.requestType) ?? null)
      : null;

    await upsertSystemRecord(
      prisma.template,
      { slug: seed.slug },
      {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        body: seed.body,
        isDefault: seed.isDefault ?? false,
        departmentId,
        requestTypeId,
      },
      {
        name: seed.name,
        description: seed.description,
        body: seed.body,
        isDefault: seed.isDefault ?? false,
        departmentId,
        requestTypeId,
        isActive: true,
        deletedAt: null,
      },
    );
  }

  log(`✓ ${TEMPLATES.length} قالب`);
}

async function seedPrompts(
  departmentIds: Map<string, string>,
  requestTypeIds: Map<string, string>,
): Promise<void> {
  for (const seed of PROMPTS) {
    const departmentId = seed.department
      ? (departmentIds.get(seed.department) ?? null)
      : null;
    const requestTypeId = seed.requestType
      ? (requestTypeIds.get(seed.requestType) ?? null)
      : null;

    await upsertSystemRecord(
      prisma.prompt,
      { key: seed.key },
      {
        key: seed.key,
        name: seed.name,
        description: seed.description,
        type: seed.type,
        content: seed.content,
        departmentId,
        requestTypeId,
      },
      {
        name: seed.name,
        description: seed.description,
        type: seed.type,
        content: seed.content,
        departmentId,
        requestTypeId,
        isActive: true,
        deletedAt: null,
      },
    );
  }

  // موجّه لكل نوع طلب، مبنيّ من زاوية الإقناع الخاصة به.
  for (const type of REQUEST_TYPES) {
    const requestTypeId = requestTypeIds.get(type.slug);
    if (!requestTypeId) continue;

    const key = `type.${type.slug}`;
    const content = `نوع الطلب: ${type.name}.

${type.angle}

احرص على أن تظهر هذه الزاوية في بنية المعروض، دون أن تُذكر هذه التعليمات نفسها.`;

    await upsertSystemRecord(
      prisma.prompt,
      { key },
      {
        key,
        name: `سياق ${type.name}`,
        description: `زاوية الإقناع الخاصة بـ${type.name}.`,
        type: 'GENERATION',
        content,
        requestTypeId,
      },
      { content, isActive: true, requestTypeId, deletedAt: null },
    );
  }

  log(`✓ ${PROMPTS.length + REQUEST_TYPES.length} موجّه`);
}

/* ==========================================================================
   الخطط والإعدادات والحسابات
   ========================================================================== */

async function seedPlans(): Promise<void> {
  for (const seed of PLANS) {
    await prisma.plan.upsert({
      where: { key: seed.key },
      create: {
        key: seed.key,
        name: seed.name,
        description: seed.description,
        priceMonthly: seed.priceMonthly,
        lettersPerMonth: seed.lettersPerMonth,
        creditsPerMonth: seed.creditsPerMonth,
        features: seed.features as unknown as Prisma.InputJsonValue,
        isPopular: seed.isPopular ?? false,
        order: seed.order,
      },
      update: {
        name: seed.name,
        description: seed.description,
        priceMonthly: seed.priceMonthly,
        lettersPerMonth: seed.lettersPerMonth,
        creditsPerMonth: seed.creditsPerMonth,
        features: seed.features as unknown as Prisma.InputJsonValue,
        isPopular: seed.isPopular ?? false,
        order: seed.order,
        isActive: true,
      },
    });
  }

  log(`✓ ${PLANS.length} خطة`);
}

async function seedSettings(): Promise<void> {
  for (const setting of SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value as Prisma.InputJsonValue,
        category: setting.category,
      },
      // لا نُحدّث القيمة: قد يكون المسؤول غيّرها عمداً من لوحة التحكم.
      update: { category: setting.category },
    });
  }

  log(`✓ ${SYSTEM_SETTINGS.length} إعداد نظام`);
}

async function seedAccounts(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    log('· تخطّي الحسابات التجريبية (بيئة إنتاج)');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  await prisma.user.upsert({
    where: { email: 'admin@maroudak.sa' },
    create: {
      email: 'admin@maroudak.sa',
      name: 'مدير المنصة',
      passwordHash,
      role: 'SUPER_ADMIN',
      creditBalance: 1000,
      city: 'الرياض',
      emailVerifiedAt: new Date(),
    },
    update: { role: 'SUPER_ADMIN', isActive: true },
  });

  const demoHash = await bcrypt.hash('Demo@12345', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@maroudak.sa' },
    create: {
      email: 'demo@maroudak.sa',
      name: 'محمد بن عبدالله السالم',
      passwordHash: demoHash,
      phone: '0512345678',
      city: 'الرياض',
      creditBalance: 25,
      emailVerifiedAt: new Date(),
    },
    update: { isActive: true },
    select: { id: true, creditBalance: true },
  });

  const hasLedger = await prisma.creditTransaction.count({
    where: { userId: demo.id },
  });
  if (hasLedger === 0) {
    await prisma.creditTransaction.create({
      data: {
        userId: demo.id,
        amount: demo.creditBalance,
        balanceAfter: demo.creditBalance,
        reason: 'SIGNUP_BONUS',
      },
    });
  }

  log('✓ حساب إدارة: admin@maroudak.sa / Admin@12345');
  log('✓ حساب تجريبي: demo@maroudak.sa / Demo@12345');
}

/* ==========================================================================
   التشغيل
   ========================================================================== */

async function main(): Promise<void> {
  console.log('\n🌱 بذر بيانات «معروضك»\n');

  const requestTypeIds = await seedRequestTypes();
  const departmentIds = await seedDepartments(requestTypeIds);
  await seedQuestions(departmentIds, requestTypeIds);
  await seedTemplates(departmentIds, requestTypeIds);
  await seedPrompts(departmentIds, requestTypeIds);
  await seedPlans();
  await seedSettings();
  await seedAccounts();

  console.log('\n✅ اكتمل البذر\n');
}

main()
  .catch((error: unknown) => {
    console.error('\n❌ فشل البذر:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
