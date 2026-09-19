import 'server-only';

import type { CreditReason, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { AppError, errors, fail, ok, type Result } from '@/lib/api/errors';
import type { CREDIT_COSTS } from '@/config/constants';
import { getSettings } from '@/lib/db/repositories/settings-repository';

/**
 * الرصيد — docs/DATABASE.md §3 · docs/AI_SYSTEM.md §5
 *
 * دفتر أستاذ: كل تغيير في الرصيد يُقابله سجل في `CreditTransaction`.
 * `User.creditBalance` مخزّن للسرعة لكنه **قابل لإعادة الاشتقاق** من الدفتر
 * (`reconcile` أدناه) — فأي انحراف قابل للكشف والإصلاح.
 *
 * القاعدة الحاكمة: **لا يُخصم رصيد إلا بعد نجاح العملية.**
 */

export type CreditOperation = keyof typeof CREDIT_COSTS;

/**
 * التكلفة من الإعدادات لا من الثوابت: قيم لوحة الإدارة كانت تُعرض وتُحفظ
 * ولا يقرؤها أحد — تعديلها بلا أثر (#D-042). الثوابت صارت الافتراضي فقط.
 */
export async function costOf(operation: CreditOperation): Promise<number> {
  const settings = await getSettings();
  return settings.creditCosts[operation];
}

/** فحص الكفاية قبل استدعاء الذكاء الاصطناعي — لا خصم هنا. */
export async function assertCanSpend(
  userId: string,
  operation: CreditOperation,
): Promise<Result<{ balance: number; cost: number }>> {
  const cost = await costOf(operation);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  });

  if (!user) return fail(errors.notFound());

  if (user.creditBalance < cost) {
    return fail(
      new AppError('INSUFFICIENT_CREDITS', {
        message:
          user.creditBalance === 0
            ? 'لا يوجد لديك رصيد. اشترِ رصيد معروض من صفحة الرصيد للمتابعة.'
            : `رصيدك (${user.creditBalance}) لا يكفي لهذه العملية (تحتاج ${cost}).`,
      }),
    );
  }

  return ok({ balance: user.creditBalance, cost });
}

export interface SpendInput {
  userId: string;
  operation: CreditOperation;
  reason: CreditReason;
  referenceId?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * خصم ذرّي داخل معاملة.
 *
 * `decrement` مع شرط `creditBalance: { gte: cost }` في `updateMany` يمنع
 * السباق: طلبان متزامنان لا يستطيعان خصم رصيد واحد مرتين.
 */
export async function spend(
  input: SpendInput,
  tx: Prisma.TransactionClient = prisma,
): Promise<Result<{ balanceAfter: number }>> {
  const cost = await costOf(input.operation);

  const updated = await tx.user.updateMany({
    where: { id: input.userId, creditBalance: { gte: cost } },
    data: { creditBalance: { decrement: cost } },
  });

  if (updated.count === 0) {
    return fail(
      new AppError('INSUFFICIENT_CREDITS', {
        message: 'رصيدك لا يكفي لإتمام هذه العملية.',
      }),
    );
  }

  const user = await tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { creditBalance: true },
  });

  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      amount: -cost,
      balanceAfter: user.creditBalance,
      reason: input.reason,
      referenceId: input.referenceId ?? null,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
  });

  return ok({ balanceAfter: user.creditBalance });
}

/** إضافة رصيد — منح خطة، تعديل إداري، أو استرجاع بعد فشل. */
export async function grant(
  input: {
    userId: string;
    amount: number;
    reason: CreditReason;
    referenceId?: string | null;
    meta?: Record<string, unknown>;
  },
  tx: Prisma.TransactionClient = prisma,
): Promise<Result<{ balanceAfter: number }>> {
  if (input.amount <= 0) {
    return fail(errors.validation({ amount: 'المبلغ يجب أن يكون موجباً.' }));
  }

  const user = await tx.user.update({
    where: { id: input.userId },
    data: { creditBalance: { increment: input.amount } },
    select: { creditBalance: true },
  });

  await tx.creditTransaction.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      balanceAfter: user.creditBalance,
      reason: input.reason,
      referenceId: input.referenceId ?? null,
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
  });

  return ok({ balanceAfter: user.creditBalance });
}

/**
 * عدد مرات استخدام أدوات الذكاء الاصطناعي على معروض — من الدفتر نفسه:
 * كل استخدام ناجح يُسجَّل حركةً (بمبلغ صفر حين تكون الأداة مشمولة)، فالعدّ
 * لا يحتاج جدولاً ولا عموداً جديداً.
 */
export async function countToolUses(userId: string, letterId: string): Promise<number> {
  return prisma.creditTransaction.count({
    where: { userId, reason: 'AI_TOOL', referenceId: letterId },
  });
}

export interface CreditSummary {
  balance: number;
  spentThisMonth: number;
  grantedThisMonth: number;
}

export async function getSummary(userId: string): Promise<CreditSummary> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    }),
    prisma.creditTransaction.findMany({
      where: { userId, createdAt: { gte: startOfMonth } },
      select: { amount: true },
    }),
  ]);

  let spent = 0;
  let granted = 0;

  for (const transaction of transactions) {
    if (transaction.amount < 0) spent += -transaction.amount;
    else granted += transaction.amount;
  }

  return {
    balance: user?.creditBalance ?? 0,
    spentThisMonth: spent,
    grantedThisMonth: granted,
  };
}

export async function listTransactions(userId: string, take = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      amount: true,
      balanceAfter: true,
      reason: true,
      createdAt: true,
    },
  });
}

/**
 * إعادة اشتقاق الرصيد من الدفتر — أداة تشخيص إدارية.
 * تُرجع الفرق إن وُجد بلا تعديل، فالإصلاح قرار بشري لا تلقائي.
 */
export async function reconcile(
  userId: string,
): Promise<{ stored: number; derived: number; drift: number }> {
  const [user, aggregate] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    }),
    prisma.creditTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  const derived = aggregate._sum.amount ?? 0;

  return {
    stored: user.creditBalance,
    derived,
    drift: user.creditBalance - derived,
  };
}
