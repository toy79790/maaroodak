import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import {
  LLMError,
  type LLMParsedResponse,
  type LLMProvider,
  type LLMRequest,
  type LLMStopReason,
  type LLMTextResponse,
  type LLMUsage,
  type SystemBlock,
} from '@/services/ai/ports';
import { env, isAIConfigured } from '@/config/env';
import { AI_DEFAULTS } from '@/config/constants';

/**
 * تنفيذ مزوّد Anthropic — المكان **الوحيد** الذي يستورد الـ SDK.
 *
 * ملاحظات API مهمة (docs/AI_SYSTEM.md §2):
 *  · `temperature` مرفوضة بـ 400 على Opus 5 / Sonnet 5 — تُرسل فقط للنماذج
 *    التي تدعم المعاينة، ويُحدَّد ذلك هنا لا عند المستدعي.
 *  · `thinking: { type: 'adaptive' }` — لا `budget_tokens` (مُزال).
 *  · العمق يُضبط بـ `output_config.effort`.
 *  · البث إلزامي للمخرجات الطويلة وإلا انتهت مهلة HTTP.
 *  · `stop_reason === 'refusal'` حالة نجاح HTTP لكنها فشل منطقي — تُفحص أولاً.
 */

/** النماذج التي تقبل معاملات المعاينة (temperature/top_p). */
const SAMPLING_CAPABLE = /^claude-haiku-|^claude-(sonnet|opus)-4-5/;

function supportsSampling(model: string): boolean {
  return SAMPLING_CAPABLE.test(model);
}

function toStopReason(raw: string | null | undefined): LLMStopReason {
  switch (raw) {
    case 'end_turn':
      return 'end_turn';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    case 'stop_sequence':
      return 'stop_sequence';
    default:
      return 'other';
  }
}

interface AnthropicUsageShape {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

function toUsage(
  raw: AnthropicUsageShape | undefined,
  model: string,
  latencyMs: number,
): LLMUsage {
  return {
    inputTokens: raw?.input_tokens ?? 0,
    outputTokens: raw?.output_tokens ?? 0,
    cachedTokens: raw?.cache_read_input_tokens ?? 0,
    model,
    latencyMs,
  };
}

/** يترجم أخطاء الـ SDK إلى أخطاء مجالنا — لا تسريب لتفاصيل المزوّد. */
function toLLMError(thrown: unknown): LLMError {
  if (thrown instanceof LLMError) return thrown;

  if (thrown instanceof Anthropic.RateLimitError) {
    return new LLMError('rate_limited', 'الخدمة مزدحمة حالياً.', { cause: thrown });
  }
  if (thrown instanceof Anthropic.AuthenticationError) {
    return new LLMError('not_configured', 'مفتاح الخدمة غير صالح.', {
      cause: thrown,
    });
  }
  if (thrown instanceof Anthropic.BadRequestError) {
    return new LLMError('invalid_request', 'طلب غير صالح للنموذج.', {
      cause: thrown,
    });
  }
  if (thrown instanceof Anthropic.APIConnectionTimeoutError) {
    return new LLMError('timeout', 'انتهت مهلة الاتصال بالخدمة.', { cause: thrown });
  }
  if (thrown instanceof Anthropic.APIError) {
    return new LLMError('unknown', 'تعذّر الاتصال بخدمة الذكاء الاصطناعي.', {
      cause: thrown,
    });
  }

  return new LLMError('unknown', 'خطأ غير متوقع في خدمة الذكاء الاصطناعي.', {
    cause: thrown,
  });
}

function buildSystem(
  system: string | SystemBlock[],
): Anthropic.TextBlockParam[] {
  const blocks = typeof system === 'string' ? [{ text: system, cache: false }] : system;

  return blocks
    .filter((block) => block.text.trim().length > 0)
    .map((block) => ({
      type: 'text' as const,
      text: block.text,
      // الطبقات الثابتة تُخزَّن مؤقتاً — التخزين مطابقة بادئة، فترتيبها مهم.
      ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }));
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic | null;

  constructor(apiKey: string = env.ANTHROPIC_API_KEY) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new LLMError(
        'not_configured',
        'خدمة الذكاء الاصطناعي غير مُهيّأة. أضف ANTHROPIC_API_KEY.',
      );
    }
    return this.client;
  }

  private baseParams(request: LLMRequest) {
    return {
      model: request.model,
      max_tokens: request.maxTokens,
      system: buildSystem(request.system),
      messages: [{ role: 'user' as const, content: request.user }],
      thinking: { type: 'adaptive' as const },
      output_config: { effort: request.effort ?? 'high' },
      ...(request.temperature !== undefined && supportsSampling(request.model)
        ? { temperature: request.temperature }
        : {}),
    };
  }

  async generateText(request: LLMRequest): Promise<LLMTextResponse> {
    const client = this.requireClient();
    const startedAt = Date.now();

    try {
      // البث إلزامي: مخرَج طويل + max_tokens كبيرة ⇒ خطر انتهاء مهلة HTTP.
      const stream = client.messages.stream(this.baseParams(request), {
        timeout: request.timeoutMs ?? AI_DEFAULTS.timeoutMs,
      });

      const message = await stream.finalMessage();
      const latencyMs = Date.now() - startedAt;
      const stopReason = toStopReason(message.stop_reason);
      const usage = toUsage(message.usage, message.model, latencyMs);

      if (stopReason === 'refusal') {
        return { text: '', stopReason, usage };
      }

      const text = message.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        )
        .map((block) => block.text)
        .join('')
        .trim();

      return { text, stopReason, usage };
    } catch (thrown) {
      throw toLLMError(thrown);
    }
  }

  async generateStructured<T>(
    request: LLMRequest,
    schema: z.ZodType<T>,
    _schemaName: string,
  ): Promise<LLMParsedResponse<T>> {
    const client = this.requireClient();
    const startedAt = Date.now();

    try {
      // `parse` لا يقبل خيارات طلب، فتُضبط المهلة على مستوى العميل.
      const message = await client
        .withOptions({ timeout: request.timeoutMs ?? AI_DEFAULTS.timeoutMs })
        .messages.parse({
          ...this.baseParams(request),
          output_config: {
            effort: request.effort ?? 'medium',
            format: zodOutputFormat(schema),
          },
        });

      const latencyMs = Date.now() - startedAt;

      return {
        // `parsed_output` تكون null إن فشل التحقق — المستدعي يتعامل معها.
        data: (message.parsed_output as T | null) ?? null,
        stopReason: toStopReason(message.stop_reason),
        usage: toUsage(message.usage, message.model, latencyMs),
      };
    } catch (thrown) {
      throw toLLMError(thrown);
    }
  }
}

let provider: LLMProvider | null = null;

export function getProvider(): LLMProvider {
  provider ??= new AnthropicProvider();
  return provider;
}

/** لحقن مزوّد وهمي في الاختبارات. */
export function setProvider(next: LLMProvider | null): void {
  provider = next;
}

export { isAIConfigured };
