import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { loadQuestionBundle, type TenantScope } from '@/lib/db/repositories/catalog-repository';
import {
  getSystemStyle,
  resolveGenerationLayers,
  resolvePrompt,
  resolveTemplate,
} from '@/lib/db/repositories/prompt-repository';
import { computeState, visibleAnswers } from '@/services/questions/engine';
import { render } from '@/services/templates/engine';
import { buildTemplateContext, defaultSubject } from '@/services/templates/variables';
import { AIService } from '@/services/ai/ai-service';
import { getProvider } from '@/services/ai/providers/anthropic';
import { LLMError } from '@/services/ai/ports';
import { assertCanSpend, spend } from '@/services/credits/credit-service';
import { recordFailure, recordUsages } from '@/services/ai/usage-tracker';
import { recordEvent } from '@/services/analytics/analytics-service';
import { AppError, errors, fail, ok, type Result } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { textToHtml } from '@/features/letters/html';
import type { QualityReport } from '@/services/ai/schemas';
import type { ScanResult } from '@/services/ai/guardrails';

/**
 * توليد المعروض — التدفّق الكامل في docs/AI_SYSTEM.md §5
 *
 * الترتيب مقصود ولا يتغيّر:
 *   فحص الرصيد (بلا خصم) → بناء السياق → توليد → ضوابط → رندر القالب
 *   → فحص جودة → معاملة واحدة (معروض + نسخة + خصم + استخدام)
 *
 * فشل الـ AI ⇒ لا خصم ولا معروض.
 * نجاح الـ AI ثم فشل الحفظ ⇒ يُسجَّل الاستخدام بحالة ORPHANED للمحاسبة.
 */

export interface GenerateResult {
  letter: {
    id: string;
    title: string;
    subject: string | null;
    contentHtml: string;
  };
  qualityReport: QualityReport | null;
  guardrails: ScanResult;
  creditBalance: number;
}

export async function generateLetter(
  userId: string,
  scope: TenantScope,
  sessionId: string,
): Promise<Result<GenerateResult>> {
  const provider = getProvider();

  if (!provider.isConfigured) {
    // اسم المتغيّر للمشغّل في السجل، لا للمستخدم في الواجهة: تفصيل داخلي
    // لا يفيد الزائر، ويكشف بنية الخادم.
    logger.error('التوليد متوقف: ANTHROPIC_API_KEY غير مضبوط', { scope: 'ai' });
    return fail(new AppError('AI_NOT_CONFIGURED'));
  }

  // --- 1) الجلسة والملكية ---------------------------------------------------
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      answers: true,
      status: true,
      department: {
        select: { id: true, name: true, slug: true, addressee: true, honorific: true },
      },
      requestType: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!session) return fail(errors.notFound('المقابلة غير موجودة.'));

  // --- 2) الرصيد (فحص فقط) -------------------------------------------------
  const canSpend = await assertCanSpend(userId, 'GENERATE_LETTER');
  if (!canSpend.ok) return fail(canSpend.error);

  // --- 3) السياق ------------------------------------------------------------
  const bundle = await loadQuestionBundle(
    scope,
    session.department.id,
    session.requestType.id,
  );

  const rawAnswers = (session.answers ?? {}) as Record<string, never>;

  const state = computeState({
    questions: bundle.questions,
    conditions: bundle.conditions,
    answers: rawAnswers,
  });

  if (state.missingRequired.length > 0) {
    return fail(
      errors.validation(
        {},
        `يلزم إكمال ${state.missingRequired.length} من الأسئلة المطلوبة قبل التوليد.`,
      ),
    );
  }

  // الإجابات المرئية فقط — إجابة سؤال أُخفي لا تدخل المعروض.
  const answers = visibleAnswers(state, rawAnswers);

  const [settings, style, layers, template, generationPrompt, qualityPrompt, user] =
    await Promise.all([
      getSettings(),
      getSystemStyle(scope),
      resolveGenerationLayers(scope, session.department.id, session.requestType.id),
      resolveTemplate(scope, session.department.id, session.requestType.id),
      resolvePrompt(scope, 'GENERATION', session.department.id, session.requestType.id),
      resolvePrompt(scope, 'QUALITY_CHECK'),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, nationalId: true, phone: true, city: true },
      }),
    ]);

  if (!template) {
    return fail(errors.internal(new Error('لا يوجد قالب مناسب لهذه الجهة.')));
  }

  const subject = defaultSubject(session.requestType.name, answers);

  // --- 4) التوليد -----------------------------------------------------------
  const ai = new AIService(provider);
  const generateModel = settings.aiModelGenerate;

  let generated;
  try {
    generated = await ai.generateLetter({
      context: {
        department: {
          name: session.department.name,
          addressee: session.department.addressee,
        },
        requestType: { name: session.requestType.name },
        applicantName: user.name,
        answers,
        questions: state.visible,
        subject,
        layers: {
          style,
          department: layers.department,
          requestType: layers.requestType,
          task: generationPrompt?.content ?? null,
        },
      },
      config: {
        model: generateModel,
        effort: settings.aiEffortGenerate,
        maxTokens: settings.aiMaxTokensGenerate,
      },
    });
  } catch (thrown) {
    const error = thrown instanceof LLMError ? thrown : null;

    await recordFailure({
      operation: 'GENERATE',
      model: generateModel,
      status: error?.kind === 'timeout' ? 'TIMEOUT' : error?.kind === 'refused' ? 'BLOCKED' : 'FAILED',
      errorCode: error?.kind ?? 'unknown',
      userId,
      organizationId: scope.organizationId,
    });

    if (error?.kind === 'refused') {
      return fail(new AppError('AI_BLOCKED'));
    }
    if (error?.kind === 'rate_limited') {
      return fail(
        new AppError('AI_FAILED', {
          message: 'الخدمة مزدحمة حالياً. حاول بعد دقيقة.',
        }),
      );
    }
    return fail(new AppError('AI_FAILED', { cause: thrown }));
  }

  // --- 5) رندر القالب -------------------------------------------------------
  const templateContext = buildTemplateContext({
    user,
    department: session.department,
    requestType: session.requestType,
    subject,
    answers,
    questions: state.visible,
    aiBody: generated.text,
  });

  const rendered = render(template.body, templateContext);
  const contentHtml = textToHtml(rendered.output);

  // --- 6) فحص الجودة (لا يمنع العرض عند الفشل) -------------------------------
  let qualityReport: QualityReport | null = null;
  const usages = [...generated.usage];

  if (settings.aiQualityCheckEnabled && qualityPrompt) {
    try {
      const quality = await ai.checkQuality({
        instruction: qualityPrompt.content,
        letterText: rendered.output,
        department: session.department,
        requestType: session.requestType,
        questions: state.visible,
        answers,
        config: {
          model: settings.aiModelQuality,
          effort: 'medium',
          maxTokens: 4000,
        },
      });

      qualityReport = quality.report;
      usages.push(quality.usage);
    } catch (error) {
      // فحص الجودة إضافة لا شرط — فشله لا يحجب المعروض عن المستخدم.
      console.error('[generate] فشل فحص الجودة', error);
    }
  }

  // --- 7) الحفظ الذرّي -------------------------------------------------------
  const title = subject.slice(0, 200);

  try {
    const letter = await prisma.$transaction(async (tx) => {
      const created = await tx.letter.create({
        data: {
          userId,
          organizationId: scope.organizationId,
          departmentId: session.department.id,
          requestTypeId: session.requestType.id,
          templateId: template.id,
          title,
          subject,
          contentHtml,
          contentText: rendered.output,
          answers: answers as Prisma.InputJsonValue,
          status: 'GENERATED',
          qualityReport: (qualityReport ?? undefined) as Prisma.InputJsonValue,
          currentVersion: 1,
        },
        select: { id: true, title: true, subject: true, contentHtml: true },
      });

      await tx.letterVersion.create({
        data: {
          letterId: created.id,
          version: 1,
          title: created.title,
          contentHtml,
          source: 'AI_GENERATED',
          createdById: userId,
        },
      });

      const spent = await spend(
        {
          userId,
          operation: 'GENERATE_LETTER',
          reason: 'GENERATE_LETTER',
          referenceId: created.id,
        },
        tx,
      );

      if (!spent.ok) throw spent.error;

      await recordUsages(
        usages,
        {
          operation: 'GENERATE',
          userId,
          organizationId: scope.organizationId,
          letterId: created.id,
        },
        tx,
      );

      await tx.interviewSession.update({
        where: { id: session.id },
        data: { status: 'CONVERTED', letterId: created.id },
      });

      return { letter: created, balance: spent.data.balanceAfter };
    });

    await recordEvent('interview_completed', {
      userId,
      props: { sessionId: session.id },
    });
    await recordEvent('letter_generated', {
      userId,
      props: {
        letterId: letter.letter.id,
        departmentSlug: session.department.slug,
        requestTypeSlug: session.requestType.slug,
        retried: generated.retried,
      },
    });

    return ok({
      letter: letter.letter,
      qualityReport,
      guardrails: generated.scan,
      creditBalance: letter.balance,
    });
  } catch (thrown) {
    /*
     * نجح نداء الذكاء الاصطناعي (وتُكبّدت تكلفته) لكن الحفظ فشل.
     * نُسجّل الاستخدام بحالة ORPHANED خارج المعاملة حتى تبقى المحاسبة
     * صادقة، ولو لم يحصل المستخدم على شيء ولم يُخصم منه رصيد.
     */
    await recordUsages(usages, {
      operation: 'GENERATE',
      status: 'ORPHANED',
      userId,
      organizationId: scope.organizationId,
    });

    if (thrown instanceof AppError) return fail(thrown);
    return fail(errors.internal(thrown));
  }
}
