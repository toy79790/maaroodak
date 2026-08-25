import type { AnswerMap, QuestionDef } from '@/types/questions';
import type {
  EffortLevel,
  LLMProvider,
  LLMUsage,
} from '@/services/ai/ports';
import { LLMError } from '@/services/ai/ports';
import {
  buildFollowUpPrompt,
  buildGenerationPrompt,
  buildQualityPrompt,
  buildToolPrompt,
  type GenerationContext,
  type ToolContext,
} from '@/services/ai/prompt-builder';
import { scan, type ScanResult } from '@/services/ai/guardrails';
import {
  followUpResultSchema,
  qualityReportSchema,
  FORBIDDEN_FOLLOW_UP_PATTERNS,
  type FollowUpQuestion,
  type QualityReport,
} from '@/services/ai/schemas';
import { buildFactsBlock } from '@/services/ai/prompt-builder';

/**
 * تنسيق عمليات الذكاء الاصطناعي — docs/AI_SYSTEM.md §5
 *
 * لا يعرف شيئاً عن Next.js ولا عن Prisma. يستقبل مزوّداً عبر الواجهة،
 * فيمكن اختباره بمزوّد وهمي بلا شبكة.
 */

export interface AIModelConfig {
  model: string;
  effort: EffortLevel;
  maxTokens: number;
  temperature?: number;
}

export interface GenerateInput {
  context: GenerationContext;
  config: AIModelConfig;
  /**
   * إعادة توليد واحدة عند مخالفة ضابط حرج.
   * محاولة واحدة فقط: تكرارها يضاعف التكلفة ونادراً ما يُصلح ما لم تُصلحه الأولى.
   */
  allowRetryOnViolation?: boolean;
}

export interface GenerateOutput {
  text: string;
  scan: ScanResult;
  usage: LLMUsage[];
  /** هل أُعيد التوليد بسبب مخالفة؟ */
  retried: boolean;
}

export class AIService {
  constructor(private readonly provider: LLMProvider) {}

  get isConfigured(): boolean {
    return this.provider.isConfigured;
  }

  // -------------------------------------------------------------------------
  // توليد المعروض
  // -------------------------------------------------------------------------

  async generateLetter(input: GenerateInput): Promise<GenerateOutput> {
    const usage: LLMUsage[] = [];
    const { facts } = buildFactsBlock(
      input.context.questions,
      input.context.answers,
    );

    const attempt = async (regenerationNote?: string) => {
      const prompt = buildGenerationPrompt({
        ...input.context,
        regenerationNote: regenerationNote ?? null,
      });

      const response = await this.provider.generateText({
        model: input.config.model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: input.config.maxTokens,
        effort: input.config.effort,
        temperature: input.config.temperature,
      });

      usage.push(response.usage);

      if (response.stopReason === 'refusal') {
        throw new LLMError(
          'refused',
          'تعذّر توليد المحتوى. يرجى مراجعة صياغة إجاباتك وإعادة المحاولة.',
        );
      }

      return response.text;
    };

    let text = await attempt();
    let result = scan({ output: text, facts });
    let retried = false;

    if (result.shouldRegenerate && input.allowRetryOnViolation !== false) {
      const note = result.violations
        .filter((violation) => violation.severity === 'block')
        .map((violation) => violation.message)
        .join(' ');

      const second = await attempt(note);
      const secondScan = scan({ output: second, facts });
      retried = true;

      // نأخذ المحاولة الثانية فقط إن كانت أفضل فعلاً — قد تكون أسوأ.
      const isBetter =
        secondScan.violations.filter((v) => v.severity === 'block').length <
        result.violations.filter((v) => v.severity === 'block').length;

      if (isBetter) {
        text = second;
        result = secondScan;
      }
    }

    return { text, scan: result, usage, retried };
  }

  // -------------------------------------------------------------------------
  // فحص الجودة
  // -------------------------------------------------------------------------

  async checkQuality(input: {
    instruction: string;
    letterText: string;
    department: { name: string };
    requestType: { name: string };
    questions: readonly QuestionDef[];
    answers: AnswerMap;
    config: AIModelConfig;
  }): Promise<{ report: QualityReport | null; usage: LLMUsage }> {
    const prompt = buildQualityPrompt(input);

    const response = await this.provider.generateStructured(
      {
        model: input.config.model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: input.config.maxTokens,
        effort: input.config.effort,
      },
      qualityReportSchema,
      'quality_report',
    );

    return { report: response.data, usage: response.usage };
  }

  // -------------------------------------------------------------------------
  // أسئلة المتابعة
  // -------------------------------------------------------------------------

  async suggestFollowUps(input: {
    instruction: string;
    department: { name: string };
    requestType: { name: string };
    questions: readonly QuestionDef[];
    answers: AnswerMap;
    askedKeys: readonly string[];
    config: AIModelConfig;
  }): Promise<{ questions: FollowUpQuestion[]; usage: LLMUsage }> {
    const prompt = buildFollowUpPrompt(input);

    const response = await this.provider.generateStructured(
      {
        model: input.config.model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: input.config.maxTokens,
        effort: input.config.effort,
      },
      followUpResultSchema,
      'follow_up_questions',
    );

    const suggested = response.data?.questions ?? [];
    const asked = new Set(input.askedKeys);

    /*
     * فلترة برمجية بعد الرد، لا اعتماداً على التعليمات وحدها.
     * التعليمات تُخالَف أحياناً، والسؤال عن معلومة موجودة يُفقد المستخدم
     * ثقته بالنظام كله. والحظر الأمني (كلمات مرور، أرقام حسابات) لا يجوز
     * أن يعتمد على طاعة النموذج.
     */
    const filtered = suggested.filter((question) => {
      if (asked.has(question.key)) return false;

      const haystack = `${question.key} ${question.question}`;
      return !FORBIDDEN_FOLLOW_UP_PATTERNS.some((pattern) =>
        pattern.test(haystack),
      );
    });

    // الأهم أولاً — المستخدم قد يتوقف بعد سؤالين.
    filtered.sort((a, b) =>
      a.importance === b.importance ? 0 : a.importance === 'critical' ? -1 : 1,
    );

    return { questions: filtered.slice(0, 5), usage: response.usage };
  }

  // -------------------------------------------------------------------------
  // أدوات التحرير
  // -------------------------------------------------------------------------

  async runTool(input: {
    context: ToolContext;
    config: AIModelConfig;
    /** الحقائق لفحص الضوابط بعد التنفيذ — للأدوات التي قد تُغري بالاختراع. */
    facts?: readonly string[];
  }): Promise<{ text: string; scan: ScanResult | null; usage: LLMUsage }> {
    const prompt = buildToolPrompt(input.context);

    const response = await this.provider.generateText({
      model: input.config.model,
      system: prompt.system,
      user: prompt.user,
      maxTokens: input.config.maxTokens,
      effort: input.config.effort,
      temperature: input.config.temperature,
    });

    if (response.stopReason === 'refusal') {
      throw new LLMError('refused', 'تعذّر تنفيذ هذه الأداة على النص.');
    }

    const cleaned = stripWrapper(response.text);

    return {
      text: cleaned,
      scan: input.facts ? scan({ output: cleaned, facts: input.facts }) : null,
      usage: response.usage,
    };
  }
}

/**
 * إزالة أي غلاف يضيفه النموذج رغم التعليمات: وسوم <text> أو أسوار شيفرة.
 * التعليمات وحدها لا تكفي، والغلاف المتسرّب يظهر مباشرة في معروض المستخدم.
 */
export function stripWrapper(text: string): string {
  return text
    .trim()
    .replace(/^<text>\s*/i, '')
    .replace(/\s*<\/text>$/i, '')
    .replace(/^```[a-z]*\n/i, '')
    .replace(/\n```$/i, '')
    .trim();
}
