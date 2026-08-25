import 'server-only';

import type { AIOperation, PromptType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { loadQuestionBundle, type TenantScope } from '@/lib/db/repositories/catalog-repository';
import { resolvePrompt } from '@/lib/db/repositories/prompt-repository';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { AIService } from '@/services/ai/ai-service';
import { getProvider } from '@/services/ai/providers/anthropic';
import { LLMError } from '@/services/ai/ports';
import { computeState } from '@/services/questions/engine';
import { extractNumbers } from '@/lib/utils/arabic';
import { htmlToText, textToHtml } from '@/features/letters/html';
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
 * كل استدعاء = نسخة جديدة + 1 Credit + سجل استخدام.
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
    select: {
      id: true,
      title: true,
      contentHtml: true,
      contentText: true,
      answers: true,
      department: { select: { id: true, name: true } },
      requestType: { select: { id: true, name: true } },
    },
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

  // التحديد إن وُجد، وإلا المعروض كاملاً.
  const targetText =
    input.selection && input.selection.trim().length > 0
      ? input.selection.trim()
      : letter.contentText;

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
    });
  }

  // --- أدوات التعديل ------------------------------------------------------
  const usedSelection =
    input.selection !== undefined &&
    input.selection !== null &&
    input.selection.trim().length > 0;

  const nextText = usedSelection
    ? letter.contentText.replace(input.selection!.trim(), result.text)
    : result.text;

  const updated = await updateLetter(
    userId,
    letterId,
    {
      contentHtml: textToHtml(nextText),
      note: `${AI_TOOL_LABELS[input.tool]}${usedSelection ? ' (على تحديد)' : ''}`,
    },
    'AI_TOOL',
  );

  if (!updated.ok) return fail(updated.error);

  const spent = await spend({
    userId,
    operation: 'AI_TOOL',
    reason: 'AI_TOOL',
    referenceId: letterId,
    meta: { tool: input.tool },
  });

  if (!spent.ok) return fail(spent.error);

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
    creditBalance: spent.data.balanceAfter,
  });
}

export { htmlToText };
export { AI_TOOLS, AI_TOOL_LABELS, type AiTool } from '@/features/letters/ai-tools';
