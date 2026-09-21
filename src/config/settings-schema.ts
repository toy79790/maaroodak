import { z } from 'zod';
import { AI_MODEL_IDS, EFFORT_LEVEL_IDS } from '@/config/constants';

/**
 * تحقّق إعدادات النظام — #D-044
 *
 * مسار `PATCH /api/admin/settings` كان يقبل **أي** مفتاح و**أي** قيمة:
 * `z.object({ key: string, value: string|number|boolean })`. الحدود
 * (min/max) كانت في مكوّن الواجهة وحده، والواجهة لا تحرس شيئاً.
 *
 * أثر ذلك ليس تجميلياً: `credits.costs.generate = -5` يجعل
 * `spend()` ينفّذ `decrement: -5` — أي **يمنح** المستخدم خمسة أرصدة عند كل
 * توليد، وبثلاثين ريالاً للرصيد. والدفتر يسجّلها متسقة فلا شيء ينبّه.
 *
 * ولأن `settings:manage` ممنوحة لدور `ADMIN` — بينما `user:manage` محجوبة
 * عنه عمداً لهذا السبب نفسه — كان الحاجز الذي بُني في `rbac.ts` قابلاً
 * للالتفاف من هنا. القائمة أدناه تسدّه: مفتاح خارجها يُرفض، وقيمة خارج
 * مداها تُرفض.
 */

/** تكلفة عملية بالأرصدة — صفر يعني «مشمولة». */
const creditCost = z.number().int().min(0).max(100);

const maxTokens = z.number().int().min(512).max(64_000);

export const SETTING_SCHEMAS = {
  'platform.name': z.string().trim().min(1).max(80),
  'platform.logoUrl': z.string().trim().max(300),
  'platform.supportEmail': z.email().max(160),

  'credits.signupBonus': z.number().int().min(0).max(1000),
  'credits.aiToolsPerLetter': z.number().int().min(0).max(100),
  'credits.costs.generate': creditCost,
  'credits.costs.regenerate': creditCost,
  'credits.costs.aiTool': creditCost,
  'credits.costs.followUp': creditCost,
  'credits.costs.qualityCheck': creditCost,

  'ai.model.generate': z.enum(AI_MODEL_IDS),
  'ai.model.tools': z.enum(AI_MODEL_IDS),
  'ai.model.quality': z.enum(AI_MODEL_IDS),
  'ai.model.followUp': z.enum(AI_MODEL_IDS),
  'ai.effort.generate': z.enum(EFFORT_LEVEL_IDS),
  'ai.effort.tools': z.enum(EFFORT_LEVEL_IDS),
  'ai.maxTokens.generate': maxTokens,
  'ai.maxTokens.tools': maxTokens,
  'ai.qualityCheck.enabled': z.boolean(),
  'ai.followUp.enabled': z.boolean(),

  'limits.generatePerWindow': z.number().int().min(1).max(100),
  'limits.aiToolPerWindow': z.number().int().min(1).max(500),
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;

export const SETTING_KEYS = Object.keys(SETTING_SCHEMAS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return Object.prototype.hasOwnProperty.call(SETTING_SCHEMAS, key);
}

export type SettingParseResult =
  | { ok: true; value: string | number | boolean }
  | { ok: false; message: string };

/**
 * يتحقق من مفتاح وقيمته معاً.
 *
 * الرسائل بالعربية لأنها تصل إلى المسؤول في اللوحة مباشرةً.
 */
export function parseSetting(key: string, value: unknown): SettingParseResult {
  if (!isSettingKey(key)) {
    return { ok: false, message: 'مفتاح إعداد غير معروف.' };
  }

  const parsed = SETTING_SCHEMAS[key].safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'قيمة غير صالحة لهذا الإعداد.',
    };
  }

  return { ok: true, value: parsed.data as string | number | boolean };
}
