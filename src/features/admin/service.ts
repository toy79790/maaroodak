import 'server-only';

import type { Prisma, PromptType, QuestionType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { errors, fail, ok, type Result } from '@/lib/api/errors';
import { detectCycle } from '@/services/questions/conditions';
import { validateTemplate } from '@/services/templates/engine';
import { SYSTEM_VARIABLES } from '@/services/templates/variables';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import type {
  CategoryInput,
  DepartmentInput,
  PromptInput,
  QuestionInput,
  RequestTypeInput,
  TemplateInput,
  UserUpdateInput,
} from '@/features/admin/schema';
import type { ConditionRule } from '@/types/questions';
import { grant } from '@/services/credits/credit-service';

/**
 * خدمة الإدارة — كل عملية تُسجَّل في `AuditLog` (docs/SECURITY.md §3).
 *
 * التحقق هنا يتجاوز مخطط Zod: قواعد سلامة لا يمكن التعبير عنها في مخطط
 * حقل واحد — تفرّد المفاتيح، ودورات الشروط، وسلامة القوالب.
 */

export interface AdminContext {
  actorId: string;
  ip?: string;
  userAgent?: string;
}

async function audit(
  context: AdminContext,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: context.actorId,
        action,
        entity,
        entityId,
        before: (before ?? undefined) as Prisma.InputJsonValue,
        after: (after ?? undefined) as Prisma.InputJsonValue,
        ip: context.ip ?? null,
        userAgent: context.userAgent?.slice(0, 256) ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] تعذّر تسجيل العملية', error);
  }
}

// ---------------------------------------------------------------------------
// الجهات
// ---------------------------------------------------------------------------

export async function saveDepartment(
  context: AdminContext,
  input: DepartmentInput,
  id?: string,
): Promise<Result<{ id: string }>> {
  const duplicate = await prisma.department.findFirst({
    where: { slug: input.slug, organizationId: null, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });

  if (duplicate) {
    return fail(
      errors.validation({ slug: 'هذا المعرّف مستخدم لجهة أخرى.' }, 'معرّف مكرر.'),
    );
  }

  const category = await prisma.departmentCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });

  if (!category) {
    return fail(errors.validation({ categoryId: 'الفئة غير موجودة.' }, 'فئة غير صالحة.'));
  }

  const data = {
    slug: input.slug,
    name: input.name,
    nameEn: input.nameEn || null,
    categoryId: input.categoryId,
    description: input.description || null,
    honorific: input.honorific || null,
    addressee: input.addressee || null,
    order: input.order,
    isActive: input.isActive,
  };

  const before = id
    ? await prisma.department.findUnique({
        where: { id },
        select: { slug: true, name: true, categoryId: true, order: true, isActive: true },
      })
    : null;

  const department = id
    ? await prisma.department.update({
        where: { id },
        data,
        select: { id: true },
      })
    : await prisma.department.create({ data, select: { id: true } });

  // استبدال كامل لروابط أنواع الطلبات.
  if (input.requestTypeIds.length > 0 || id) {
    await prisma.$transaction([
      prisma.departmentRequestType.deleteMany({
        where: {
          departmentId: department.id,
          requestTypeId: { notIn: input.requestTypeIds },
        },
      }),
      ...input.requestTypeIds.map((requestTypeId, index) =>
        prisma.departmentRequestType.upsert({
          where: {
            departmentId_requestTypeId: {
              departmentId: department.id,
              requestTypeId,
            },
          },
          create: { departmentId: department.id, requestTypeId, order: index },
          update: { order: index, isActive: true },
        }),
      ),
    ]);
  }

  await audit(
    context,
    id ? 'department.update' : 'department.create',
    'Department',
    department.id,
    before,
    data,
  );

  return ok({ id: department.id });
}

/** حذف ناعم — الجهة قد تكون مرتبطة بمعاريض مستخدمين (docs/DECISIONS.md #D-020). */
export async function deleteDepartment(
  context: AdminContext,
  id: string,
): Promise<Result<null>> {
  const letters = await prisma.letter.count({ where: { departmentId: id } });

  await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit(context, 'department.delete', 'Department', id, { letters }, null);
  return ok(null);
}

// ---------------------------------------------------------------------------
// فئات الجهات — #D-036
// ---------------------------------------------------------------------------

export async function saveCategory(
  context: AdminContext,
  input: CategoryInput,
  id?: string,
): Promise<Result<{ id: string }>> {
  const duplicate = await prisma.departmentCategory.findFirst({
    where: { slug: input.slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });

  if (duplicate) {
    return fail(errors.validation({ slug: 'هذا المعرّف مستخدم لفئة أخرى.' }, 'معرّف مكرر.'));
  }

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    order: input.order,
    isActive: input.isActive,
  };

  const before = id
    ? await prisma.departmentCategory.findUnique({
        where: { id },
        select: { slug: true, name: true, order: true, isActive: true },
      })
    : null;

  if (id && !before) return fail(errors.notFound('الفئة غير موجودة.'));

  const record = id
    ? await prisma.departmentCategory.update({ where: { id }, data, select: { id: true } })
    : await prisma.departmentCategory.create({ data, select: { id: true } });

  await audit(
    context,
    id ? 'category.update' : 'category.create',
    'DepartmentCategory',
    record.id,
    before,
    data,
  );

  return ok({ id: record.id });
}

/**
 * حذف نهائي، لكن لفئة فارغة فقط. الجهات المحذوفة حذفاً ناعماً تبقى مرتبطة
 * بفئتها (المفتاح الأجنبي Restrict)، فتُحسب هنا أيضاً — والبديل للمسؤول هو
 * التعطيل، الذي يُخفي الفئة وجهاتها دون أن يمسّ شيئاً.
 */
export async function deleteCategory(
  context: AdminContext,
  id: string,
): Promise<Result<null>> {
  const departments = await prisma.department.count({ where: { categoryId: id } });

  if (departments > 0) {
    return fail(
      errors.conflict(
        `لا يمكن حذف فئة مرتبطة بـ ${departments} جهة (بما فيها المحذوفة). انقل الجهات إلى فئة أخرى، أو عطّل الفئة بدل حذفها.`,
      ),
    );
  }

  const deleted = await prisma.departmentCategory.deleteMany({ where: { id } });
  if (deleted.count === 0) return fail(errors.notFound('الفئة غير موجودة.'));

  await audit(context, 'category.delete', 'DepartmentCategory', id, null, null);
  return ok(null);
}

// ---------------------------------------------------------------------------
// أنواع الطلبات
// ---------------------------------------------------------------------------

export async function saveRequestType(
  context: AdminContext,
  input: RequestTypeInput,
  id?: string,
): Promise<Result<{ id: string }>> {
  const duplicate = await prisma.requestType.findFirst({
    where: { slug: input.slug, organizationId: null, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });

  if (duplicate) {
    return fail(errors.validation({ slug: 'هذا المعرّف مستخدم.' }, 'معرّف مكرر.'));
  }

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    icon: input.icon || null,
    order: input.order,
    isActive: input.isActive,
  };

  const record = id
    ? await prisma.requestType.update({ where: { id }, data, select: { id: true } })
    : await prisma.requestType.create({ data, select: { id: true } });

  await audit(
    context,
    id ? 'requestType.update' : 'requestType.create',
    'RequestType',
    record.id,
    null,
    data,
  );

  return ok({ id: record.id });
}

// ---------------------------------------------------------------------------
// الأسئلة
// ---------------------------------------------------------------------------

/**
 * حفظ سؤال مع خياراته وشروطه.
 *
 * الفحص الحاسم: **كشف الدورات**. قاعدة دائرية (أ يُظهر ب وب يُظهر أ) تجعل
 * حالة المقابلة غير قابلة للتحديد، ولا يمكن للمحرك أن يشفي منها وقت التشغيل.
 * الرفض هنا أرخص بكثير من اكتشافها في تدفّق مستخدم.
 */
export async function saveQuestion(
  context: AdminContext,
  input: QuestionInput,
  id?: string,
): Promise<Result<{ id: string }>> {
  // تفرّد المفتاح ضمن النطاق نفسه.
  const duplicate = await prisma.question.findFirst({
    where: {
      key: input.key,
      departmentId: input.departmentId ?? null,
      requestTypeId: input.requestTypeId ?? null,
      organizationId: null,
      deletedAt: null,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    return fail(
      errors.validation(
        { key: 'يوجد سؤال بنفس المفتاح في هذا النطاق.' },
        'مفتاح مكرر.',
      ),
    );
  }

  const needsOptions = ['SELECT', 'RADIO', 'CHECKBOX'].includes(input.type);
  if (needsOptions && input.options.length < 2) {
    return fail(
      errors.validation(
        { options: 'هذا النوع يتطلب خيارين على الأقل.' },
        'خيارات ناقصة.',
      ),
    );
  }

  // --- كشف الدورات على كامل نطاق هذا السؤال -------------------------------
  if (input.conditions.length > 0) {
    const scopeQuestions = await prisma.question.findMany({
      where: {
        deletedAt: null,
        organizationId: null,
        OR: [
          { departmentId: null, requestTypeId: null },
          { departmentId: null, requestTypeId: input.requestTypeId ?? undefined },
          { departmentId: input.departmentId ?? undefined, requestTypeId: null },
          {
            departmentId: input.departmentId ?? undefined,
            requestTypeId: input.requestTypeId ?? undefined,
          },
        ],
      },
      select: {
        id: true,
        key: true,
        conditions: { select: { id: true, action: true, logic: true, clauses: true, order: true } },
      },
    });

    const keyById = new Map(scopeQuestions.map((q) => [q.id, q.key]));

    const existingRules: ConditionRule[] = scopeQuestions
      .filter((question) => question.id !== id)
      .flatMap((question) =>
        question.conditions.map((condition) => ({
          id: condition.id,
          targetQuestionKey: keyById.get(question.id) ?? question.key,
          action: condition.action,
          logic: condition.logic,
          clauses: (condition.clauses ?? []) as unknown as ConditionRule['clauses'],
          order: condition.order,
        })),
      );

    const proposedRules: ConditionRule[] = input.conditions.map(
      (condition, index) => ({
        id: `new-${index}`,
        targetQuestionKey: input.key,
        action: condition.action,
        logic: condition.logic,
        clauses: condition.clauses as unknown as ConditionRule['clauses'],
        order: index,
      }),
    );

    const cycle = detectCycle([...existingRules, ...proposedRules]);
    if (cycle.hasCycle) {
      return fail(
        errors.validation(
          {
            conditions: `اعتماد دائري بين الأسئلة: ${cycle.path.join(' ← ')}. لا يمكن حفظ هذه القاعدة.`,
          },
          'قاعدة شرطية دائرية.',
        ),
      );
    }

    // مصادر الشروط يجب أن تكون أسئلة موجودة في النطاق.
    const knownKeys = new Set(scopeQuestions.map((q) => q.key));
    const unknown = input.conditions
      .flatMap((condition) => condition.clauses.map((c) => c.sourceQuestionKey))
      .filter((key) => key !== input.key && !knownKeys.has(key));

    if (unknown.length > 0) {
      return fail(
        errors.validation(
          { conditions: `مفاتيح غير موجودة في هذا النطاق: ${[...new Set(unknown)].join('، ')}` },
          'مصدر شرط غير معروف.',
        ),
      );
    }
  }

  const data = {
    key: input.key,
    label: input.label,
    description: input.description || null,
    type: input.type as QuestionType,
    required: input.required,
    placeholder: input.placeholder || null,
    helpText: input.helpText || null,
    groupKey: input.groupKey || null,
    order: input.order,
    aiHint: input.aiHint || null,
    validation: (input.validation ?? null) as Prisma.InputJsonValue,
    departmentId: input.departmentId ?? null,
    requestTypeId: input.requestTypeId ?? null,
    isActive: input.isActive,
  };

  const question = await prisma.$transaction(async (tx) => {
    const record = id
      ? await tx.question.update({ where: { id }, data, select: { id: true } })
      : await tx.question.create({ data, select: { id: true } });

    // استبدال كامل للخيارات والشروط — أبسط وأسلم من المزامنة الجزئية.
    await tx.questionOption.deleteMany({ where: { questionId: record.id } });
    if (input.options.length > 0) {
      await tx.questionOption.createMany({
        data: input.options.map((option, index) => ({
          questionId: record.id,
          value: option.value,
          label: option.label,
          order: index,
        })),
      });
    }

    await tx.questionCondition.deleteMany({
      where: { targetQuestionId: record.id },
    });
    for (const [index, condition] of input.conditions.entries()) {
      await tx.questionCondition.create({
        data: {
          targetQuestionId: record.id,
          action: condition.action,
          logic: condition.logic,
          clauses: condition.clauses as unknown as Prisma.InputJsonValue,
          order: index,
        },
      });
    }

    return record;
  });

  await audit(
    context,
    id ? 'question.update' : 'question.create',
    'Question',
    question.id,
    null,
    { key: input.key, conditions: input.conditions.length },
  );

  return ok({ id: question.id });
}

export async function deleteQuestion(
  context: AdminContext,
  id: string,
): Promise<Result<null>> {
  await prisma.question.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit(context, 'question.delete', 'Question', id);
  return ok(null);
}

export async function reorderQuestions(
  context: AdminContext,
  items: ReadonlyArray<{ id: string; order: number }>,
): Promise<Result<null>> {
  await prisma.$transaction(
    items.map((item) =>
      prisma.question.update({
        where: { id: item.id },
        data: { order: item.order },
      }),
    ),
  );

  await audit(context, 'question.reorder', 'Question', null, null, {
    count: items.length,
  });
  return ok(null);
}

// ---------------------------------------------------------------------------
// القوالب
// ---------------------------------------------------------------------------

export async function saveTemplate(
  context: AdminContext,
  input: TemplateInput,
  id?: string,
): Promise<Result<{ id: string; warnings: string[] }>> {
  const issues = validateTemplate(input.body, [...SYSTEM_VARIABLES]);

  // الأخطاء البنيوية تمنع الحفظ؛ المتغيرات المجهولة تحذير فقط
  // (قد يكون المتغير صحيحاً لكنه من إجابة سؤال في نطاق آخر).
  const blocking = issues.filter((issue) => issue.type !== 'unknown_variable');
  if (blocking.length > 0) {
    return fail(
      errors.validation(
        { body: blocking.map((issue) => issue.message).join(' · ') },
        'القالب يحتوي أخطاء بنيوية.',
      ),
    );
  }

  const duplicate = await prisma.template.findFirst({
    where: { slug: input.slug, organizationId: null, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });

  if (duplicate) {
    return fail(errors.validation({ slug: 'هذا المعرّف مستخدم.' }, 'معرّف مكرر.'));
  }

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    body: input.body,
    departmentId: input.departmentId ?? null,
    requestTypeId: input.requestTypeId ?? null,
    isDefault: input.isDefault,
    isActive: input.isActive,
  };

  const template = id
    ? await prisma.template.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        select: { id: true },
      })
    : await prisma.template.create({ data, select: { id: true } });

  // قالب افتراضي واحد فقط.
  if (input.isDefault) {
    await prisma.template.updateMany({
      where: { organizationId: null, isDefault: true, NOT: { id: template.id } },
      data: { isDefault: false },
    });
  }

  await audit(
    context,
    id ? 'template.update' : 'template.create',
    'Template',
    template.id,
    null,
    { slug: input.slug },
  );

  return ok({
    id: template.id,
    warnings: issues.map((issue) => issue.message),
  });
}

// ---------------------------------------------------------------------------
// الموجّهات
// ---------------------------------------------------------------------------

export async function savePrompt(
  context: AdminContext,
  input: PromptInput,
  id?: string,
): Promise<Result<{ id: string }>> {
  const duplicate = await prisma.prompt.findFirst({
    where: { key: input.key, organizationId: null, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });

  if (duplicate) {
    return fail(errors.validation({ key: 'هذا المفتاح مستخدم.' }, 'مفتاح مكرر.'));
  }

  const data = {
    key: input.key,
    name: input.name,
    description: input.description || null,
    type: input.type as PromptType,
    content: input.content,
    model: input.model || null,
    maxTokens: input.maxTokens ?? null,
    departmentId: input.departmentId ?? null,
    requestTypeId: input.requestTypeId ?? null,
    isActive: input.isActive,
  };

  const prompt = id
    ? await prisma.prompt.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        select: { id: true },
      })
    : await prisma.prompt.create({ data, select: { id: true } });

  await audit(
    context,
    id ? 'prompt.update' : 'prompt.create',
    'Prompt',
    prompt.id,
    null,
    { key: input.key, type: input.type },
  );

  return ok({ id: prompt.id });
}

// ---------------------------------------------------------------------------
// المستخدمون
// ---------------------------------------------------------------------------

export async function updateUser(
  context: AdminContext,
  userId: string,
  input: UserUpdateInput,
): Promise<Result<{ creditBalance: number }>> {
  // حارس: لا يستطيع المسؤول تعطيل نفسه أو خفض دوره — يقفل نفسه خارج اللوحة.
  if (userId === context.actorId) {
    if (input.isActive === false || input.role !== undefined) {
      return fail(
        errors.forbidden('لا يمكنك تعديل دورك أو تعطيل حسابك من هنا.'),
      );
    }
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, creditBalance: true },
  });

  if (!before) return fail(errors.notFound());

  if (input.role !== undefined || input.isActive !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    // تعطيل الحساب يُبطل جلساته فوراً — وإلا بقي يعمل حتى انتهاء الرمز.
    if (input.isActive === false) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  let creditBalance = before.creditBalance;

  if (input.creditAdjustment && input.creditAdjustment !== 0) {
    if (input.creditAdjustment > 0) {
      const granted = await grant({
        userId,
        amount: input.creditAdjustment,
        reason: 'ADMIN_ADJUST',
        meta: { note: input.adjustmentNote ?? '', by: context.actorId },
      });
      if (!granted.ok) return fail(granted.error);
      creditBalance = granted.data.balanceAfter;
    } else {
      const amount = input.creditAdjustment;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });
      // لا نسمح برصيد سالب.
      creditBalance = Math.max(updated.creditBalance, 0);
      if (updated.creditBalance < 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { creditBalance: 0 },
        });
      }
      await prisma.creditTransaction.create({
        data: {
          userId,
          amount,
          balanceAfter: creditBalance,
          reason: 'ADMIN_ADJUST',
          meta: { note: input.adjustmentNote ?? '', by: context.actorId },
        },
      });
    }
  }

  await audit(context, 'user.update', 'User', userId, before, input);

  return ok({ creditBalance });
}

// ---------------------------------------------------------------------------
// الإعدادات
// ---------------------------------------------------------------------------

export async function saveSetting(
  context: AdminContext,
  key: string,
  value: unknown,
): Promise<Result<null>> {
  const before = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });

  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updatedById: context.actorId },
    update: { value: value as Prisma.InputJsonValue, updatedById: context.actorId },
  });

  invalidateSettingsCache();
  await audit(context, 'setting.update', 'SystemSetting', key, before, { value });

  return ok(null);
}

export async function listAuditLogs(take = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      createdAt: true,
      ip: true,
      actor: { select: { name: true, email: true } },
    },
  });
}
