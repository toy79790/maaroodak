import type { z } from 'zod';

/**
 * حدود طبقة الذكاء الاصطناعي — docs/ARCHITECTURE.md §7
 *
 * هذا الملف **لا يستورد أي SDK**. كل ما تحته من خدمات يعتمد على هذه
 * الواجهة فقط، فإضافة مزوّد آخر = ملف تنفيذ واحد بلا تغيير في أي مستدعٍ،
 * واختبار الخدمات لا يحتاج شبكة.
 */

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface LLMRequest {
  model: string;
  system: string | SystemBlock[];
  user: string;
  maxTokens: number;
  effort?: EffortLevel;
  /**
   * يُرسل فقط للنماذج التي تدعم المعاينة.
   * نماذج Opus 5 / Sonnet 5 ترفضه بـ 400 — انظر docs/DECISIONS.md #D-012
   */
  temperature?: number;
  timeoutMs?: number;
}

export interface SystemBlock {
  text: string;
  /** يُخزَّن مؤقتاً — للطبقات الثابتة عبر الطلبات (docs/AI_SYSTEM.md §11). */
  cache?: boolean;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  model: string;
  latencyMs: number;
}

export type LLMStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'refusal'
  | 'stop_sequence'
  | 'other';

export interface LLMTextResponse {
  text: string;
  stopReason: LLMStopReason;
  usage: LLMUsage;
}

export interface LLMParsedResponse<T> {
  data: T | null;
  stopReason: LLMStopReason;
  usage: LLMUsage;
}

/** الأخطاء التي يُميّزها المستدعي — لا نُسرّب أخطاء SDK فوق هذه الطبقة. */
export type LLMErrorKind =
  | 'not_configured'
  | 'rate_limited'
  | 'timeout'
  | 'refused'
  | 'invalid_request'
  | 'unknown';

export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly retryable: boolean;

  constructor(kind: LLMErrorKind, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = 'LLMError';
    this.kind = kind;
    this.cause = options.cause;
    this.retryable = kind === 'rate_limited' || kind === 'timeout';
  }
}

export interface LLMProvider {
  readonly name: string;
  readonly isConfigured: boolean;

  /** توليد نص — يستخدم البث داخلياً للمخرجات الطويلة. */
  generateText(request: LLMRequest): Promise<LLMTextResponse>;

  /** مخرَج مهيكل مُتحقَّق منه بمخطط Zod. */
  generateStructured<T>(
    request: LLMRequest,
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<LLMParsedResponse<T>>;
}
