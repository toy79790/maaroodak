import type { z } from 'zod';
import type {
  LLMParsedResponse,
  LLMProvider,
  LLMRequest,
  LLMTextResponse,
  LLMUsage,
} from '@/services/ai/ports';
import { LLMError } from '@/services/ai/ports';

/**
 * مزوّد ذكاء اصطناعي وهمي — docs/TESTING.md §4
 *
 * لا نداء شبكي في أي اختبار. يسجّل الطلبات ليتمكن الاختبار من التحقق من
 * محتوى الـ Prompt نفسه (وهو منتَج بقدر ما هو وسيلة).
 */

export interface FakeBehavior {
  /** النص المُعاد من generateText — أو دالة تُقرّر حسب الطلب. */
  text?: string | ((request: LLMRequest, callIndex: number) => string);
  /** المخرَج المهيكل المُعاد من generateStructured. */
  structured?: unknown;
  /** يرمي هذا الخطأ بدل الرد. */
  error?: LLMError;
  /** يُرجع stop_reason = refusal. */
  refuse?: boolean;
}

export class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';
  isConfigured = true;

  readonly textRequests: LLMRequest[] = [];
  readonly structuredRequests: LLMRequest[] = [];

  constructor(private behavior: FakeBehavior = {}) {}

  setBehavior(behavior: FakeBehavior): void {
    this.behavior = behavior;
  }

  private usage(model: string): LLMUsage {
    return {
      inputTokens: 1200,
      outputTokens: 400,
      cachedTokens: 800,
      model,
      latencyMs: 42,
    };
  }

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    this.textRequests.push(request);

    if (this.behavior.error) throw this.behavior.error;

    if (this.behavior.refuse) {
      return {
        text: '',
        stopReason: 'refusal',
        usage: this.usage(request.model),
      };
    }

    const { text } = this.behavior;
    const resolved =
      typeof text === 'function'
        ? text(request, this.textRequests.length - 1)
        : (text ?? 'نص افتراضي من المزوّد الوهمي.');

    return {
      text: resolved,
      stopReason: 'end_turn',
      usage: this.usage(request.model),
    };
  }

  async generateStructured<T>(
    request: LLMRequest,
    _schema: z.ZodType<T>,
    _name: string,
  ): Promise<LLMParsedResponse<T>> {
    this.structuredRequests.push(request);

    if (this.behavior.error) throw this.behavior.error;

    return {
      data: (this.behavior.structured as T | undefined) ?? null,
      stopReason: 'end_turn',
      usage: this.usage(request.model),
    };
  }

  /** كل نصوص الـ system في آخر طلب — للتحقق من ترتيب الطبقات. */
  lastSystemTexts(): string[] {
    const last = this.textRequests[this.textRequests.length - 1];
    if (!last) return [];
    return typeof last.system === 'string'
      ? [last.system]
      : last.system.map((block) => block.text);
  }

  lastUserPrompt(): string {
    return this.textRequests[this.textRequests.length - 1]?.user ?? '';
  }

  reset(): void {
    this.textRequests.length = 0;
    this.structuredRequests.length = 0;
  }
}

/** تقرير جودة ناجح بالكامل — للاختبارات التي لا تفحص الجودة نفسها. */
export function passingQualityReport() {
  const pass = {
    passed: true,
    severity: 'none' as const,
    message: 'سليم',
    evidence: [],
    suggestion: null,
  };

  return {
    usesOnlyProvidedInfo: pass,
    hasContradiction: pass,
    hasRepetition: pass,
    requestIsClear: pass,
    departmentIsSuitable: pass,
    toneIsFormal: pass,
    languageIsCorrect: pass,
    missingInformation: pass,
    overallScore: 92,
    summary: 'المعروض جاهز للتقديم.',
  };
}
