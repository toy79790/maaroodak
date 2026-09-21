import 'server-only';

import { prisma } from '@/lib/db/prisma';
import {
  AI_DEFAULTS,
  AI_TOOLS_PER_LETTER,
  CREDIT_COSTS,
  EFFORT_LEVEL_IDS,
  RATE_LIMITS,
  SIGNUP_BONUS_CREDITS,
} from '@/config/constants';
import { site } from '@/config/site';
import type { EffortLevel } from '@/services/ai/ports';

/**
 * إعدادات النظام — docs/API.md §7
 *
 * تُقرأ من `SystemSetting` مع قيم افتراضية آمنة من `config/constants`.
 * إعداد مفقود أو تالف يجب ألّا يوقف المنصة، فالقراءة دائماً بتراجع.
 *
 * مُخزَّنة مؤقتاً لمدة قصيرة: تُقرأ في كل عملية توليد، وقراءة قاعدة بيانات
 * لكل نداء بلا داعٍ — مع بقاء تعديل المسؤول ساري المفعول خلال دقيقة.
 */

export interface AppSettings {
  platformName: string;
  supportEmail: string;

  signupBonusCredits: number;
  creditCosts: Record<keyof typeof CREDIT_COSTS, number>;
  /** حد أدوات الذكاء الاصطناعي لكل معروض — #D-042 */
  aiToolsPerLetter: number;

  aiModelGenerate: string;
  aiModelTools: string;
  aiModelQuality: string;
  aiModelFollowUp: string;
  aiEffortGenerate: EffortLevel;
  aiEffortTools: EffortLevel;
  aiMaxTokensGenerate: number;
  aiMaxTokensTools: number;
  aiQualityCheckEnabled: boolean;
  aiFollowUpEnabled: boolean;

  /**
   * حدود الاستخدام. كانت معروضة في اللوحة ومزروعة في القاعدة ولا يقرؤها
   * أحد: المسؤول يغيّر الرقم ويُحفظ، والحدّ الفعلي يبقى ثابتاً في الشيفرة
   * (#D-044).
   */
  limitGeneratePerWindow: number;
  limitAiToolPerWindow: number;
}

const CACHE_TTL_MS = 60_000;

let cache: { value: AppSettings; expiresAt: number } | null = null;

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

const EFFORT_LEVELS: readonly EffortLevel[] = EFFORT_LEVEL_IDS;

function asEffort(value: unknown, fallback: EffortLevel): EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.includes(value as EffortLevel)
    ? (value as EffortLevel)
    : fallback;
}

export async function getSettings(): Promise<AppSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  let rows: Array<{ key: string; value: unknown }> = [];

  try {
    rows = await prisma.systemSetting.findMany({
      select: { key: true, value: true },
    });
  } catch (error) {
    // القاعدة غير متاحة — نعمل بالافتراضيات بدل أن نُسقط الطلب.
    console.error('[settings] تعذّرت قراءة الإعدادات، استُخدمت الافتراضيات', error);
  }

  const map = new Map(rows.map((row) => [row.key, row.value]));

  const value: AppSettings = {
    platformName: asString(map.get('platform.name'), site.name),
    supportEmail: asString(map.get('platform.supportEmail'), site.supportEmail),

    signupBonusCredits: asNumber(
      map.get('credits.signupBonus'),
      SIGNUP_BONUS_CREDITS,
    ),
    aiToolsPerLetter: asNumber(map.get('credits.aiToolsPerLetter'), AI_TOOLS_PER_LETTER),
    creditCosts: {
      GENERATE_LETTER: asNumber(
        map.get('credits.costs.generate'),
        CREDIT_COSTS.GENERATE_LETTER,
      ),
      REGENERATE: asNumber(
        map.get('credits.costs.regenerate'),
        CREDIT_COSTS.REGENERATE,
      ),
      AI_TOOL: asNumber(map.get('credits.costs.aiTool'), CREDIT_COSTS.AI_TOOL),
      FOLLOW_UP: asNumber(
        map.get('credits.costs.followUp'),
        CREDIT_COSTS.FOLLOW_UP,
      ),
      QUALITY_CHECK: asNumber(
        map.get('credits.costs.qualityCheck'),
        CREDIT_COSTS.QUALITY_CHECK,
      ),
    },

    aiModelGenerate: asString(map.get('ai.model.generate'), AI_DEFAULTS.generateModel),
    aiModelTools: asString(map.get('ai.model.tools'), AI_DEFAULTS.toolsModel),
    aiModelQuality: asString(map.get('ai.model.quality'), AI_DEFAULTS.qualityModel),
    aiModelFollowUp: asString(map.get('ai.model.followUp'), AI_DEFAULTS.followUpModel),
    aiEffortGenerate: asEffort(map.get('ai.effort.generate'), 'high'),
    aiEffortTools: asEffort(map.get('ai.effort.tools'), 'medium'),
    aiMaxTokensGenerate: asNumber(
      map.get('ai.maxTokens.generate'),
      AI_DEFAULTS.generateMaxTokens,
    ),
    aiMaxTokensTools: asNumber(
      map.get('ai.maxTokens.tools'),
      AI_DEFAULTS.toolsMaxTokens,
    ),
    aiQualityCheckEnabled: asBoolean(map.get('ai.qualityCheck.enabled'), true),
    aiFollowUpEnabled: asBoolean(map.get('ai.followUp.enabled'), true),

    limitGeneratePerWindow: asNumber(
      map.get('limits.generatePerWindow'),
      RATE_LIMITS.generate.limit,
    ),
    limitAiToolPerWindow: asNumber(
      map.get('limits.aiToolPerWindow'),
      RATE_LIMITS.aiTool.limit,
    ),
  };

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/** يُستدعى بعد أي تعديل إداري حتى يسري فوراً. */
export function invalidateSettingsCache(): void {
  cache = null;
}

export async function updateSetting(
  key: string,
  value: unknown,
  updatedById?: string,
): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedById: updatedById ?? null },
    update: { value: value as never, updatedById: updatedById ?? null },
  });

  invalidateSettingsCache();
}

export async function listSettings() {
  return prisma.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
    select: { key: true, value: true, category: true, updatedAt: true },
  });
}
