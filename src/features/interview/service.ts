import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  loadQuestionBundle,
  isRequestTypeAllowed,
  getDepartment,
  getRequestType,
  type TenantScope,
} from '@/lib/db/repositories/catalog-repository';
import {
  computeState,
  nextStepIndex,
  previousStepIndex,
} from '@/services/questions/engine';
import { validateAnswer } from '@/services/questions/validation';
import { errors, fail, ok, type Result } from '@/lib/api/errors';
import type { AnswerMap, EngineState } from '@/types/questions';
import { recordEvent } from '@/services/analytics/analytics-service';

/**
 * خدمة المقابلة — تربط محرك الأسئلة النقي بالتخزين.
 *
 * كل دالة تتحقق من ملكية الجلسة **داخل شرط الاستعلام**، فلا يمكن لمستخدم
 * الوصول إلى مقابلة غيره حتى بمعرّف صحيح (docs/SECURITY.md §3).
 */

export interface InterviewContext {
  sessionId: string;
  department: { id: string; name: string; slug: string };
  requestType: { id: string; name: string; slug: string };
  state: EngineState;
  answers: AnswerMap;
}

function toAnswerMap(value: unknown): AnswerMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AnswerMap;
}

async function buildContext(
  scope: TenantScope,
  session: {
    id: string;
    answers: unknown;
    currentStep: number;
    department: { id: string; name: string; slug: string };
    requestType: { id: string; name: string; slug: string };
  },
): Promise<InterviewContext> {
  const answers = toAnswerMap(session.answers);
  const bundle = await loadQuestionBundle(
    scope,
    session.department.id,
    session.requestType.id,
  );

  const state = computeState({
    questions: bundle.questions,
    conditions: bundle.conditions,
    answers,
    currentStepIndex: session.currentStep,
  });

  return {
    sessionId: session.id,
    department: session.department,
    requestType: session.requestType,
    state,
    answers,
  };
}

const SESSION_SELECT = {
  id: true,
  answers: true,
  currentStep: true,
  status: true,
  department: { select: { id: true, name: true, slug: true } },
  requestType: { select: { id: true, name: true, slug: true } },
} as const;

// ---------------------------------------------------------------------------
// بدء المقابلة
// ---------------------------------------------------------------------------

export async function startInterview(
  userId: string,
  scope: TenantScope,
  input: { departmentId: string; requestTypeId: string },
): Promise<Result<InterviewContext>> {
  const [department, requestType] = await Promise.all([
    getDepartment(scope, input.departmentId),
    getRequestType(scope, input.requestTypeId),
  ]);

  if (!department || !requestType) {
    return fail(errors.notFound('الجهة أو نوع الطلب غير متاح.'));
  }

  // لا نثق بالعميل: نتحقق أن هذا النوع مرتبط فعلاً بهذه الجهة.
  const allowed = await isRequestTypeAllowed(department.id, requestType.id);
  if (!allowed) {
    return fail(
      errors.validation(
        { requestTypeId: 'نوع الطلب هذا غير متاح لهذه الجهة.' },
        'اختيار غير صالح.',
      ),
    );
  }

  /*
   * استئناف بدل الإنشاء: لو بدأ المستخدم نفس الثنائية ولم يكملها، نُعيده
   * إليها. إنشاء جلسة جديدة في كل مرة يُنتج مسودات مهجورة ويُفقد إجاباته.
   */
  const existing = await prisma.interviewSession.findFirst({
    where: {
      userId,
      departmentId: department.id,
      requestTypeId: requestType.id,
      status: 'IN_PROGRESS',
    },
    orderBy: { lastActiveAt: 'desc' },
    select: SESSION_SELECT,
  });

  if (existing) {
    return ok(await buildContext(scope, existing));
  }

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      departmentId: department.id,
      requestTypeId: requestType.id,
      answers: {},
      currentStep: 0,
    },
    select: SESSION_SELECT,
  });

  await recordEvent('interview_started', {
    userId,
    props: {
      departmentSlug: department.slug,
      requestTypeSlug: requestType.slug,
    },
  });

  return ok(await buildContext(scope, session));
}

// ---------------------------------------------------------------------------
// القراءة
// ---------------------------------------------------------------------------

export async function getInterview(
  userId: string,
  scope: TenantScope,
  sessionId: string,
): Promise<Result<InterviewContext>> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: SESSION_SELECT,
  });

  if (!session) return fail(errors.notFound('المقابلة غير موجودة.'));

  return ok(await buildContext(scope, session));
}

// ---------------------------------------------------------------------------
// الإجابة
// ---------------------------------------------------------------------------

export interface AnswerInput {
  /** خريطة إجابات الخطوة الحالية — قد تحوي سؤالاً أو سؤالين. */
  answers: Record<string, unknown>;
  /** الانتقال للخطوة التالية بعد الحفظ. */
  advance?: boolean;
}

export interface AnswerResult extends InterviewContext {
  fieldErrors: Record<string, string>;
}

export async function submitAnswers(
  userId: string,
  scope: TenantScope,
  sessionId: string,
  input: AnswerInput,
): Promise<Result<AnswerResult>> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    select: SESSION_SELECT,
  });

  if (!session) return fail(errors.notFound('المقابلة غير موجودة أو مكتملة.'));

  const bundle = await loadQuestionBundle(
    scope,
    session.department.id,
    session.requestType.id,
  );

  const answers = toAnswerMap(session.answers);
  const currentState = computeState({
    questions: bundle.questions,
    conditions: bundle.conditions,
    answers,
    currentStepIndex: session.currentStep,
  });

  const byKey = new Map(currentState.visible.map((q) => [q.key, q]));

  const fieldErrors: Record<string, string> = {};
  const accepted: AnswerMap = {};

  for (const [key, raw] of Object.entries(input.answers)) {
    const question = byKey.get(key);

    // إجابة لسؤال غير مرئي = محاولة تجاوز المنطق الشرطي. تُتجاهل بصمت.
    if (!question) continue;

    const result = validateAnswer(question, raw);
    if (!result.ok) {
      fieldErrors[key] = result.error ?? 'قيمة غير صالحة';
      continue;
    }
    accepted[key] = result.value ?? null;
  }

  const nextAnswers: AnswerMap = { ...answers, ...accepted };

  /*
   * إعادة الحساب بالإجابات الجديدة **قبل** تحديد الخطوة التالية.
   * إجابة واحدة قد تُظهر فرعاً كاملاً أو تُخفيه، فحساب «التالي» على الحالة
   * القديمة يقفز فوق أسئلة ظهرت للتو أو يقف عند أسئلة اختفت.
   */
  const recomputedState = computeState({
    questions: bundle.questions,
    conditions: bundle.conditions,
    answers: nextAnswers,
    currentStepIndex: session.currentStep,
  });

  const hasErrors = Object.keys(fieldErrors).length > 0;

  const nextStep =
    !hasErrors && input.advance
      ? nextStepIndex(recomputedState, nextAnswers)
      : session.currentStep;

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      answers: nextAnswers as never,
      currentStep: nextStep,
      lastActiveAt: new Date(),
    },
    select: SESSION_SELECT,
  });

  if (!hasErrors) {
    await recordEvent('question_answered', {
      userId,
      props: {
        sessionId: session.id,
        keys: Object.keys(accepted),
        step: session.currentStep,
      },
    });
  }

  return ok({ ...(await buildContext(scope, updated)), fieldErrors });
}

// ---------------------------------------------------------------------------
// التنقّل
// ---------------------------------------------------------------------------

export async function goBack(
  userId: string,
  scope: TenantScope,
  sessionId: string,
): Promise<Result<InterviewContext>> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    select: SESSION_SELECT,
  });

  if (!session) return fail(errors.notFound('المقابلة غير موجودة.'));

  const context = await buildContext(scope, session);

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      currentStep: previousStepIndex(context.state),
      lastActiveAt: new Date(),
    },
    select: SESSION_SELECT,
  });

  return ok(await buildContext(scope, updated));
}

export async function goToStep(
  userId: string,
  scope: TenantScope,
  sessionId: string,
  stepIndex: number,
): Promise<Result<InterviewContext>> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    select: SESSION_SELECT,
  });

  if (!session) return fail(errors.notFound('المقابلة غير موجودة.'));

  const context = await buildContext(scope, session);
  const safeIndex = Math.min(Math.max(stepIndex, 0), context.state.totalSteps);

  const updated = await prisma.interviewSession.update({
    where: { id: session.id },
    data: { currentStep: safeIndex, lastActiveAt: new Date() },
    select: SESSION_SELECT,
  });

  return ok(await buildContext(scope, updated));
}

export async function abandonInterview(
  userId: string,
  sessionId: string,
): Promise<Result<null>> {
  const updated = await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId, status: 'IN_PROGRESS' },
    data: { status: 'ABANDONED' },
  });

  if (updated.count === 0) return fail(errors.notFound());

  await recordEvent('interview_abandoned', {
    userId,
    props: { sessionId },
  });

  return ok(null);
}
