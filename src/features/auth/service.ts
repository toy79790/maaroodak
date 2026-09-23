import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  hashPassword,
  isCommonPassword,
  verifyPassword,
  verifyPasswordConstantTime,
} from '@/lib/auth/password';
import { createSession, revokeAllSessions } from '@/lib/auth/session';
import { AppError, errors, fail, ok, type Result } from '@/lib/api/errors';
import { PASSWORD_RESET_TTL_MINUTES } from '@/config/constants';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { absoluteUrl, env, isDevelopment } from '@/config/env';
import { passwordResetMessage, sendMail } from '@/lib/mail/mailer';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '@/features/auth/schema';

/**
 * خدمة المصادقة — docs/SECURITY.md §2
 *
 * مبدأ حاكم: لا تكشف أي نقطة نهاية هنا ما إن كان بريد ما مسجّلاً.
 * الردود موحّدة عند التسجيل والاستعادة والدخول.
 */

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- التسجيل ----------------------------------------------------------------

export async function register(
  input: RegisterInput,
  meta: RequestMeta = {},
): Promise<Result<{ id: string; email: string; name: string }>> {
  if (isCommonPassword(input.password)) {
    return fail(
      errors.validation({ password: 'كلمة المرور شائعة جداً. اختر كلمة أقوى.' }),
    );
  }

  const passwordHash = await hashPassword(input.password);
  // من الإعدادات: الافتراضي صفر (#D-042)، والمسؤول يستطيع منح رصيد ترحيبي.
  const { signupBonusCredits } = await getSettings();

  try {
    // الخصم والمنح والحساب في معاملة واحدة: مستخدم بلا رصيد ابتدائي
    // أو حركة بلا مستخدم كلاهما حالة فاسدة.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          phone: input.phone || null,
          creditBalance: signupBonusCredits,
        },
        select: { id: true, email: true, name: true },
      });

      // حركة بمبلغ صفر ضجيج في الدفتر — تُسجَّل المنحة فقط حين توجد.
      if (signupBonusCredits > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: created.id,
            amount: signupBonusCredits,
            balanceAfter: signupBonusCredits,
            reason: 'SIGNUP_BONUS',
          },
        });
      }

      return created;
    });

    await createSession(user.id, meta);
    return ok(user);
  } catch (thrown) {
    if (
      thrown instanceof Prisma.PrismaClientKnownRequestError &&
      thrown.code === 'P2002'
    ) {
      // البريد مستخدم. نُرجع رسالة محايدة لا تؤكد وجود الحساب.
      return fail(
        errors.validation(
          { email: 'تعذّر إنشاء الحساب بهذا البريد. جرّب بريداً آخر أو سجّل الدخول.' },
          'تعذّر إنشاء الحساب.',
        ),
      );
    }
    throw thrown;
  }
}

// --- الدخول -----------------------------------------------------------------

const INVALID_CREDENTIALS = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';

export async function login(
  input: LoginInput,
  meta: RequestMeta = {},
): Promise<Result<{ id: string; email: string; name: string }>> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isActive: true,
    },
  });

  // مقارنة دائمة الزمن حتى مع بريد غير موجود — تمنع تعداد الحسابات بالتوقيت.
  const valid = await verifyPasswordConstantTime(
    input.password,
    user?.passwordHash,
  );

  if (!user || !valid) {
    return fail(new AppError('UNAUTHORIZED', INVALID_CREDENTIALS));
  }

  if (!user.isActive) {
    return fail(
      new AppError('FORBIDDEN', 'هذا الحساب معطّل. يرجى التواصل مع الدعم.'),
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createSession(user.id, meta);

  return ok({ id: user.id, email: user.email, name: user.name });
}

// --- استعادة كلمة المرور -----------------------------------------------------

export interface ForgotPasswordResult {
  /** في التطوير فقط: الرابط يُعاد لتسهيل الاختبار بلا خادم بريد. */
  devResetUrl?: string;
}

export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<Result<ForgotPasswordResult>> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, isActive: true },
  });

  // الرد ناجح دائماً — لا نكشف ما إن كان البريد مسجّلاً.
  if (!user || !user.isActive) return ok({});

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);

  // إبطال أي رموز سابقة غير مستخدمة: رمز واحد صالح في أي لحظة.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    }),
  ]);

  // `absoluteUrl` لا `env.APP_URL`: الأخير اختياري وفارغ عادةً، فكان الرابط
  // يخرج نسبياً بلا نطاق — لا يُفتح من البريد.
  const resetUrl = absoluteUrl(`/reset-password?token=${token}`);

  /*
   * الرابط في الرد يمنح أي زائر حساب صاحب البريد — فالشرط مزدوج (#D-048):
   * بيئة التطوير **و** بناء غير إنتاجي. `next start` محلياً بـ APP_ENV=development
   * لا يُرجعه أيضاً؛ خطأ في أحد المتغيّرين وحده لا يكفي لكشفه.
   */
  if (isDevelopment && env.NODE_ENV !== 'production') {
    console.info(`\n[dev] رابط استعادة كلمة المرور:\n${resetUrl}\n`);
    return ok({ devResetUrl: resetUrl });
  }

  /*
   * بلا `await` عمداً: انتظار خادم SMTP يجعل الرد أبطأ حين يكون البريد مسجّلاً،
   * فيكشف التوقيت ما يُخفيه الرد الموحّد. `sendMail` لا يرمي، ويسجّل فشله.
   */
  void sendMail(passwordResetMessage(user.email, resetUrl, PASSWORD_RESET_TTL_MINUTES));
  return ok({});
}

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<Result<null>> {
  if (isCommonPassword(input.password)) {
    return fail(
      errors.validation({ password: 'كلمة المرور شائعة جداً. اختر كلمة أقوى.' }),
    );
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  const isUsable =
    record && !record.usedAt && record.expiresAt.getTime() > Date.now();

  if (!isUsable) {
    return fail(
      errors.validation(
        { token: 'رابط الاستعادة منتهٍ أو مستخدم مسبقاً.' },
        'رابط الاستعادة غير صالح.',
      ),
    );
  }

  const passwordHash = await hashPassword(input.password);

  /*
   * الاستهلاك بـ`updateMany` مشروطاً بـ`usedAt: null` لا بـ`update` على
   * المعرّف: الفحص أعلاه قراءة، وبين القراءة والكتابة تتسع نافذة يمر فيها
   * طلبان بالرمز نفسه. العدّاد صفر يعني أن غيرنا سبقنا — نتوقف (#D-044).
   */
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (claimed.count === 0) {
    return fail(
      errors.validation(
        { token: 'رابط الاستعادة منتهٍ أو مستخدم مسبقاً.' },
        'رابط الاستعادة غير صالح.',
      ),
    );
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash },
  });

  // استعادة كلمة المرور تعني احتمال اختراق — تُبطل كل الجلسات بلا استثناء.
  await revokeAllSessions(record.userId);

  return ok(null);
}

// --- تغيير كلمة المرور -------------------------------------------------------

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: ChangePasswordInput,
): Promise<Result<{ revokedSessions: number }>> {
  if (isCommonPassword(input.next)) {
    return fail(
      errors.validation({ next: 'كلمة المرور شائعة جداً. اختر كلمة أقوى.' }),
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) return fail(errors.notFound());

  const valid = await verifyPassword(input.current, user.passwordHash);
  if (!valid) {
    return fail(
      errors.validation({ current: 'كلمة المرور الحالية غير صحيحة.' }),
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.next) },
  });

  // الجلسة الحالية تبقى: المستخدم غيّرها طوعاً ولا معنى لإخراجه من جهازه.
  const revokedSessions = await revokeAllSessions(userId, currentSessionId);

  return ok({ revokedSessions });
}
