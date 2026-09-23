import 'server-only';

import type { AIOperation, Prisma, PromptType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { loadQuestionBundle, type TenantScope } from '@/lib/db/repositories/catalog-repository';
import { resolvePrompt } from '@/lib/db/repositories/prompt-repository';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { AIService } from '@/services/ai/ai-service';
import { getProvider } from '@/services/ai/providers/anthropic';
import { LLMError } from '@/services/ai/ports';
import { computeState } from '@/services/questions/engine';
import { extractNumbers } from '@/lib/utils/arabic';
import { htmlToText, replaceTextInHtml, textToHtml } from '@/features/letters/html';
import { assertCanSpend, spend } from '@/services/credits/credit-service';
import { recordFailure, recordUsage } from '@/services/ai/usage-tracker';
import { recordEvent } from '@/services/analytics/analytics-service';
import { updateLetter } from '@/features/letters/service';
import { AppError, errors, fail, ok, type Result } from '@/lib/api/errors';
import type { AnswerMap } from '@/types/questions';
import {
  AI_TOOL_LABELS,
  SUGGESTION_ONLY_TOOLS,
  type AiTool,
} from '@/features/letters/ai-tools';

/**
 * أدوات التحرير العشر — docs/AI_SYSTEM.md §10
 *
 * تُطبَّق على التحديد إن وُجد، وإلا على النص كاملاً.
 * كل استدعاء = نسخة جديدة + حركة في الدفتر + سجل استخدام. مشمولة مع المعروض
 * بحد لكل معروض، وتكلفتها بالرصيد من الإعدادات (صفر افتراضياً) — #D-042.
 */


const TOOL_PROMPT_TYPE: Record<AiTool, PromptType> = {
  IMPROVE: 'TOOL_IMPROVE',
  FORMALIZE: 'TOOL_FORMALIZE',
  SHORTEN: 'TOOL_SHORTEN',
  EXPAND: 'TOOL_EXPAND',
  CLARIFY: 'TOOL_CLARIFY',
  REWRITE: 'TOOL_REWRITE',
  TITLE: 'TOOL_TITLE',
  INTRO: 'TOOL_INTRO',
  CONCLUSION: 'TOOL_CONCLUSION',
  PROOFREAD: 'TOOL_PROOFREAD',
};

const TOOL_OPERATION: Record<AiTool, AIOperation> = {
  IMPROVE: 'IMPROVE',
  FORMALIZE: 'FORMALIZE',
  SHORTEN: 'SHORTEN',
  EXPAND: 'EXPAND',
  CLARIFY: 'CLARIFY',
  REWRITE: 'REWRITE',
  TITLE: 'TITLE',
  INTRO: 'INTRO',
  CONCLUSION: 'CONCLUSION',
  PROOFREAD: 'PROOFREAD',
};

/** الأدوات التي تُغري النموذج بإضافة معلومات ⇒ تُمرَّر معها الحقائق وتُفحص بعدها. */
const FACT_SENSITIVE: ReadonlySet<AiTool> = new Set(['EXPAND', 'REWRITE', 'CLARIFY']);




export interface RunToolInput {
  tool: AiTool;
  /** النص المحدَّد — إن غاب طُبّقت الأداة على المعروض كاملاً. */
  selection?: string | null;
}

export interface RunToolResult {
  tool: AiTool;
  /** المعروض بعد التعديل (غائب لأدوات الاقتراح). */
  contentHtml?: string;
  /** اقتراحات — أداة العنوان. */
  suggestions?: string[];
  /** تحذيرات ضوابط ظهرت بعد التنفيذ. */
  warnings: string[];
  creditBalance: number;
  /** ما تبقّى من أدوات الذكاء الاصطناعي المشمولة لهذا المعروض — #D-042 */
  toolsRemaining: number;
}

export async function runAiTool(
  userId: string,
  scope: TenantScope,
  letterId: string,
  input: RunToolInput,
): Promise<Result<RunToolResult>> {
  const provider = getProvider();

  if (!provider.isConfigured) {
    return fail(new AppError('AI_NOT_CONFIGURED'));
  }

  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: TOOL_LETTER_SELECT,
  });

  if (!letter) return fail(errors.notFound('المعروض غير موجود.'));

  const canSpend = await assertCanSpend(userId, 'AI_TOOL');
  if (!canSpend.ok) return fail(canSpend.error);

  const [settings, prompt] = await Promise.all([
    getSettings(),
    resolvePrompt(scope, TOOL_PROMPT_TYPE[input.tool]),
  ]);

  if (!prompt) {
    return fail(errors.internal(new Error(`لا يوجد موجّه للأداة ${input.tool}.`)));
  }

  // التحديد إن وُجد، وإلا المعروض كاملاً.
  const selection = input.selection?.trim() ?? '';
  const usedSelection = selection.length > 0 && !SUGGESTION_ONLY_TOOLS.has(input.tool);

  // التحقق من إمكان الاستبدال **قبل** النداء: التكلفة تقع عند النداء نفسه.
  if (usedSelection && replaceTextInHtml(letter.contentHtml, selection, '') === null) {
    return fail(
      errors.validation(
        { selection: 'النص المحدَّد غير موجود في المعروض المحفوظ.' },
        'تعذّر العثور على النص المحدَّد. احفظ تعديلاتك ثم حدّد النص من جديد.',
      ),
    );
  }

  /*
   * حجز الاستخدام قبل النداء — #D-046
   *
   * الحد كان يُعدّ من الدفتر، والدفتر لا يُكتب إلا بعد النداء: عشرة طلبات
   * متزامنة ترى العدد نفسه وتمرّ كلها، وكل واحد نداء مدفوع. الحجز زيادة
   * مشروطة في `updateMany` — لا يمرّ منها إلا ما يتسع له الحد.
   */
  const reserved = await reserveToolUse(userId, letterId, settings.aiToolsPerLetter);

  if (reserved === null) {
    return fail(
      new AppError('QUOTA_EXCEEDED', {
        message: `استخدمت التحسينات المشمولة لهذا المعروض (${settings.aiToolsPerLetter}). يمكنك مواصلة التعديل يدوياً في المحرر بلا حدود.`,
      }),
    );
  }

  // يُضبط حين يُثبَّت الاستخدام في القاعدة (خصم أو تعديل) — لا قبل ولا بعد.
  const progress = { committed: false };
  try {
    return await executeTool({
      userId,
      scope,
      letterId,
      input,
      letter,
      settings,
      prompt,
      provider,
      selection,
      usedSelection,
      toolsRemaining: Math.max(settings.aiToolsPerLetter - reserved, 0),
      progress,
    });
  } finally {
    /*
     * الإفلات بحسب ما ثُبّت لا بحسب النتيجة: خطأ في التسجيل بعد تثبيت
     * الخصم كان يُفلت حجزاً دُفع ثمنه، فيصير الاستخدام مجانياً (#D-047).
     */
    if (!progress.committed) await releaseToolUse(letterId);
  }
}

/** يحجز استخداماً ويُرجع العدد بعده، أو null إن بلغ الحد. */
async function reserveToolUse(
  userId: string,
  letterId: string,
  limit: number,
): Promise<number | null> {
  const reserved = await prisma.letter.updateMany({
    where: { id: letterId, userId, deletedAt: null, aiToolUses: { lt: limit } },
    data: { aiToolUses: { increment: 1 } },
  });

  if (reserved.count === 0) return null;

  const letter = await prisma.letter.findUniqueOrThrow({
    where: { id: letterId },
    select: { aiToolUses: true },
  });
  return letter.aiToolUses;
}

async function releaseToolUse(letterId: string): Promise<void> {
  await prisma.letter
    .updateMany({
      where: { id: letterId, aiToolUses: { gt: 0 } },
      data: { aiToolUses: { decrement: 1 } },
    })
    .catch((error: unknown) => {
      // الأسوأ استخدام محتسب بلا نتيجة — لا نحجب الرد بسببه.
      console.error('[ai-tool] تعذّر إفلات حجز الاستخدام', error);
    });
}

const TOOL_LETTER_SELECT = {
  id: true,
  title: true,
  contentHtml: true,
  contentText: true,
  currentVersion: true,
  answers: true,
  department: { select: { id: true, name: true } },
  requestType: { select: { id: true, name: true } },
} satisfies Prisma.LetterSelect;

interface ToolExecution {
  userId: string;
  scope: TenantScope;
  letterId: string;
  input: RunToolInput;
  letter: Prisma.LetterGetPayload<{ select: typeof TOOL_LETTER_SELECT }>;
  settings: Awaited<ReturnType<typeof getSettings>>;
  prompt: NonNullable<Awaited<ReturnType<typeof resolvePrompt>>>;
  provider: ReturnType<typeof getProvider>;
  selection: string;
  usedSelection: boolean;
  toolsRemaining: number;
  progress: { committed: boolean };
}

async function executeTool(ctx: ToolExecution): Promise<Result<RunToolResult>> {
  const {
    userId,
    scope,
    letterId,
    input,
    letter,
    settings,
    prompt,
    provider,
    selection,
    usedSelection,
    toolsRemaining,
    progress,
  } = ctx;

  const answers = (letter.answers ?? {}) as AnswerMap;
  const needsFacts = FACT_SENSITIVE.has(input.tool);

  let questions: Awaited<ReturnType<typeof loadQuestionBundle>>['questions'] = [];
  let facts: string[] = [];

  if (needsFacts) {
    const bundle = await loadQuestionBundle(
      scope,
      letter.department.id,
      letter.requestType.id,
    );
    const state = computeState({
      questions: bundle.questions,
      conditions: bundle.conditions,
      answers,
    });
    questions = state.visible;
    facts = Object.values(answers).map((value) => String(value ?? ''));
  }

  const targetText = selection.length > 0 ? selection : letter.contentText;

  const ai = new AIService(provider);
  const model = settings.aiModelTools;

  let result;
  try {
    result = await ai.runTool({
      context: {
        instruction: prompt.content,
        text: targetText,
        ...(needsFacts ? { questions, answers } : {}),
        department: letter.department,
        requestType: letter.requestType,
      },
      config: {
        model,
        effort: settings.aiEffortTools,
        maxTokens: settings.aiMaxTokensTools,
      },
      ...(needsFacts ? { facts } : {}),
    });
  } catch (thrown) {
    const error = thrown instanceof LLMError ? thrown : null;

    await recordFailure({
      operation: TOOL_OPERATION[input.tool],
      model,
      status: error?.kind === 'timeout' ? 'TIMEOUT' : error?.kind === 'refused' ? 'BLOCKED' : 'FAILED',
      errorCode: error?.kind ?? 'unknown',
      userId,
      organizationId: scope.organizationId,
      letterId,
    });

    if (error?.kind === 'refused') return fail(new AppError('AI_BLOCKED'));
    return fail(new AppError('AI_FAILED', { cause: thrown }));
  }

  const warnings: string[] = [];

  /*
   * التدقيق اللغوي يُمنع من تغيير المعنى، وأخطر تغيير هو الأرقام.
   * نقارن مجموعة الأعداد قبل وبعد ونرفض المخرَج إن اختلفت — أرخص وأدق
   * من الاعتماد على التزام النموذج بالتعليمات.
   */
  if (input.tool === 'PROOFREAD') {
    const before = new Set(extractNumbers(targetText));
    const after = new Set(extractNumbers(result.text));
    const changed =
      before.size !== after.size ||
      [...after].some((number) => !before.has(number));

    if (changed) {
      await recordUsage({
        operation: TOOL_OPERATION[input.tool],
        usage: result.usage,
        status: 'BLOCKED',
        errorCode: 'proofread_changed_numbers',
        userId,
        organizationId: scope.organizationId,
        letterId,
      });

      return fail(
        new AppError('AI_BLOCKED', {
          message:
            'تعذّر التدقيق: المخرَج غيّر أرقاماً في النص. لم يُطبَّق أي تعديل ولم يُخصم رصيد.',
        }),
      );
    }
  }

  if (result.scan) {
    for (const violation of result.scan.violations) {
      if (violation.severity !== 'info') warnings.push(violation.message);
    }
  }

  // --- أدوات الاقتراح: لا تُعدّل المعروض ---------------------------------
  if (SUGGESTION_ONLY_TOOLS.has(input.tool)) {
    const suggestions = result.text
      .split('\n')
      .map((line) => line.replace(/^[-•*\d.\s]+/, '').trim())
      .filter((line) => line.length >= 4)
      .slice(0, 3);

    const spent = await spend({
      userId,
      operation: 'AI_TOOL',
      reason: 'AI_TOOL',
      referenceId: letterId,
      meta: { tool: input.tool },
    });

    if (!spent.ok) return fail(spent.error);
    progress.committed = true;

    await recordUsage({
      operation: TOOL_OPERATION[input.tool],
      usage: result.usage,
      userId,
      organizationId: scope.organizationId,
      letterId,
    });

    await recordEvent('ai_tool_used', {
      userId,
      props: { letterId, tool: input.tool },
    });

    return ok({
      tool: input.tool,
      suggestions,
      warnings,
      creditBalance: spent.data.balanceAfter,
      toolsRemaining,
    });
  }

  // --- أدوات التعديل ------------------------------------------------------
  // على التحديد: استبدال داخل الـ HTML يحفظ تنسيق باقي المعروض. على المعروض
  // كاملاً: النموذج أعاد كتابة النص كله، فيُبنى HTML جديد من مخرَجه.
  const nextHtml = usedSelection
    ? replaceTextInHtml(letter.contentHtml, selection, result.text)
    : textToHtml(result.text);

  if (nextHtml === null) {
    // تغيّر المعروض أثناء النداء (حفظ من نافذة أخرى) — النداء دُفع ولم يُستخدم.
    await recordUsage({
      operation: TOOL_OPERATION[input.tool],
      usage: result.usage,
      status: 'ORPHANED',
      errorCode: 'selection_not_found',
      userId,
      organizationId: scope.organizationId,
      letterId,
    });

    return fail(
      errors.conflict('تغيّر المعروض أثناء التنفيذ. لم يُطبَّق أي تعديل ولم يُحتسب الاستخدام.'),
    );
  }

  // الخصم داخل معاملة التعديل نفسها: تعديل بلا خصم أو خصم بلا تعديل كلاهما فاسد.
  let balanceAfter = 0;
  const updated = await updateLetter(
    userId,
    letterId,
    {
      contentHtml: nextHtml,
      note: `${AI_TOOL_LABELS[input.tool]}${usedSelection ? ' (على تحديد)' : ''}`,
      // الناتج مبني على نسخة ما قبل النداء: حفظٌ في الأثناء لا يُكتب فوقه.
      expectedVersion: letter.currentVersion,
    },
    'AI_TOOL',
    async (tx) => {
      const spent = await spend(
        {
          userId,
          operation: 'AI_TOOL',
          reason: 'AI_TOOL',
          referenceId: letterId,
          meta: { tool: input.tool },
        },
        tx,
      );
      if (!spent.ok) throw spent.error;
      balanceAfter = spent.data.balanceAfter;
    },
  );

  if (!updated.ok) {
    // النداء دُفع ولم يُحفظ ناتجه — يُسجَّل للمحاسبة كما في التوليد.
    await recordUsage({
      operation: TOOL_OPERATION[input.tool],
      usage: result.usage,
      status: 'ORPHANED',
      errorCode: updated.error.code.toLowerCase(),
      userId,
      organizationId: scope.organizationId,
      letterId,
    });
    return fail(updated.error);
  }
  progress.committed = true;

  await recordUsage({
    operation: TOOL_OPERATION[input.tool],
    usage: result.usage,
    userId,
    organizationId: scope.organizationId,
    letterId,
  });

  await recordEvent('ai_tool_used', {
    userId,
    props: { letterId, tool: input.tool, onSelection: usedSelection },
  });

  return ok({
    tool: input.tool,
    contentHtml: updated.data.contentHtml,
    warnings,
    creditBalance: balanceAfter,
    toolsRemaining,
  });
}

export { htmlToText };
export { AI_TOOLS, AI_TOOL_LABELS, type AiTool } from '@/features/letters/ai-tools';
