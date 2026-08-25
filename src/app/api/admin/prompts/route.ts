import { z } from 'zod';
import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { promptSchema } from '@/features/admin/schema';
import { savePrompt } from '@/features/admin/service';
import { listPromptsAdmin } from '@/features/admin/queries';
import { getProvider } from '@/services/ai/providers/anthropic';
import { CORE_GUARDRAILS } from '@/services/ai/guardrails';
import { computeCostUsd } from '@/services/ai/usage-tracker';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { LLMError } from '@/services/ai/ports';
import { AppError } from '@/lib/api/errors';

export const GET = createAdminHandler(
  { permission: 'prompt:manage' },
  async () => jsonOk(await listPromptsAdmin()),
);

export const POST = createAdminHandler(
  { permission: 'prompt:manage', body: promptSchema },
  async ({ body, admin }) => {
    const result = await savePrompt(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);

/**
 * تجربة موجّه على بيانات وهمية — docs/API.md §7
 *
 * أهم أداة لجودة المنتج: تتيح ضبط الصياغة بلا نشر وبلا استهلاك رصيد
 * المستخدمين. لا تحفظ شيئاً ولا تُنشئ معروضاً.
 */
const testSchema = z.object({
  content: z.string().min(10).max(20000),
  sampleFacts: z.string().max(4000).default(''),
  model: z.string().max(60).optional(),
});

export const PUT = createAdminHandler(
  { permission: 'prompt:manage', body: testSchema },
  async ({ body }) => {
    const provider = getProvider();

    if (!provider.isConfigured) {
      return jsonError(new AppError('AI_NOT_CONFIGURED'));
    }

    const settings = await getSettings();
    const model = body.model || settings.aiModelGenerate;

    const facts =
      body.sampleFacts.trim() ||
      [
        '- الاسم الكامل: محمد بن عبدالله السالم',
        '- المدينة: الرياض',
        '- قيمة المديونية: 85000',
        '- الجهة الدائنة: بنك الرياض',
        '- سبب المديونية: قرض لعلاج والدتي',
      ].join('\n');

    const started = Date.now();

    try {
      const response = await provider.generateText({
        model,
        system: [
          { text: CORE_GUARDRAILS, cache: true },
          { text: body.content, cache: false },
        ],
        user: [
          'الجهة المخاطَبة: وزارة الموارد البشرية والتنمية الاجتماعية',
          'نوع الطلب: طلب سداد مديونية',
          '',
          'معلومات المستخدم:',
          '<user_facts>',
          facts,
          '</user_facts>',
          '',
          'اكتب الآن متن المعروض بناءً على ما سبق حصراً.',
        ].join('\n'),
        maxTokens: settings.aiMaxTokensGenerate,
        effort: settings.aiEffortGenerate,
      });

      return jsonOk({
        output: response.text,
        stopReason: response.stopReason,
        model: response.usage.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costUsd: computeCostUsd(response.usage),
        latencyMs: Date.now() - started,
      });
    } catch (thrown) {
      const error = thrown instanceof LLMError ? thrown : null;
      return jsonError(
        new AppError('AI_FAILED', {
          message: error?.message ?? 'تعذّر تشغيل الموجّه.',
        }),
      );
    }
  },
);
