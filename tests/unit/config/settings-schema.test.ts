import { describe, expect, it } from 'vitest';
import {
  SETTING_KEYS,
  isSettingKey,
  parseSetting,
} from '@/config/settings-schema';
import { AI_MODEL_IDS, EFFORT_LEVEL_IDS } from '@/config/constants';

/**
 * تحقّق إعدادات النظام — #D-044
 *
 * الحالة الحرجة أولاً: تكلفة سالبة. `spend()` ينفّذ `decrement: cost`،
 * فتكلفة `-5` تمنح المستخدم خمسة أرصدة عند كل توليد.
 */

describe('parseSetting — يمنع القيم المدمِّرة للرصيد', () => {
  it.each([
    'credits.costs.generate',
    'credits.costs.regenerate',
    'credits.costs.aiTool',
    'credits.costs.followUp',
    'credits.costs.qualityCheck',
  ])('%s لا يقبل قيمة سالبة', (key) => {
    expect(parseSetting(key, -5).ok).toBe(false);
    expect(parseSetting(key, -0.5).ok).toBe(false);
  });

  it('التكلفة تقبل صفراً (مشمولة) وترفض ما فوق المئة', () => {
    expect(parseSetting('credits.costs.aiTool', 0)).toEqual({ ok: true, value: 0 });
    expect(parseSetting('credits.costs.generate', 101).ok).toBe(false);
  });

  it('التكلفة عدد صحيح لا كسري ولا نصّي', () => {
    expect(parseSetting('credits.costs.generate', 1.5).ok).toBe(false);
    expect(parseSetting('credits.costs.generate', '1').ok).toBe(false);
  });

  it('رصيد الترحيب لا يقبل مليوناً', () => {
    expect(parseSetting('credits.signupBonus', 1_000_000).ok).toBe(false);
    expect(parseSetting('credits.signupBonus', 0)).toEqual({ ok: true, value: 0 });
  });
});

describe('parseSetting — قائمة مفاتيح مغلقة', () => {
  it('مفتاح غير معروف يُرفض', () => {
    expect(parseSetting('credits.costs.whatever', 1)).toEqual({
      ok: false,
      message: 'مفتاح إعداد غير معروف.',
    });
  });

  it('لا يُخدع بخصائص الكائن الموروثة', () => {
    expect(isSettingKey('toString')).toBe(false);
    expect(isSettingKey('constructor')).toBe(false);
    expect(parseSetting('__proto__', 1).ok).toBe(false);
  });
});

describe('parseSetting — النماذج ومستويات العمق قوائم مغلقة', () => {
  it.each(AI_MODEL_IDS)('يقبل النموذج %s', (model) => {
    expect(parseSetting('ai.model.generate', model)).toEqual({
      ok: true,
      value: model,
    });
  });

  it('يرفض معرّف نموذج مجهول', () => {
    expect(parseSetting('ai.model.generate', 'claude-opus-4').ok).toBe(false);
    expect(parseSetting('ai.model.tools', '').ok).toBe(false);
  });

  it.each(EFFORT_LEVEL_IDS)('يقبل العمق %s', (effort) => {
    expect(parseSetting('ai.effort.tools', effort).ok).toBe(true);
  });

  it('يرفض عمقاً مجهولاً', () => {
    expect(parseSetting('ai.effort.generate', 'ultra').ok).toBe(false);
  });
});

describe('parseSetting — بقية الأنواع', () => {
  it('المنطقي منطقي لا نص', () => {
    expect(parseSetting('ai.qualityCheck.enabled', true).ok).toBe(true);
    expect(parseSetting('ai.qualityCheck.enabled', 'true').ok).toBe(false);
  });

  it('بريد الدعم بريد صالح', () => {
    expect(parseSetting('platform.supportEmail', 'a@b.com').ok).toBe(true);
    expect(parseSetting('platform.supportEmail', 'ليس بريداً').ok).toBe(false);
  });

  it('اسم المنصة لا يكون فارغاً', () => {
    expect(parseSetting('platform.name', '   ').ok).toBe(false);
  });

  it('حدود الاستخدام ضمن مدى معقول', () => {
    expect(parseSetting('limits.generatePerWindow', 5).ok).toBe(true);
    expect(parseSetting('limits.generatePerWindow', 0).ok).toBe(false);
    expect(parseSetting('limits.aiToolPerWindow', 501).ok).toBe(false);
  });

  it('حدّ الرموز ضمن مدى النموذج', () => {
    expect(parseSetting('ai.maxTokens.generate', 8000).ok).toBe(true);
    expect(parseSetting('ai.maxTokens.generate', 10).ok).toBe(false);
  });
});

describe('تطابق القائمة مع ما يقرؤه الخادم', () => {
  it('كل مفتاح مزروع في القاعدة له مخطط تحقق', async () => {
    const { SYSTEM_SETTINGS } = await import('../../../prisma/seed-data/plans');
    const seeded = SYSTEM_SETTINGS.map((setting) => setting.key);
    const missing = seeded.filter((key) => !isSettingKey(key));
    expect(missing).toEqual([]);
  });

  it('القائمة غير فارغة', () => {
    expect(SETTING_KEYS.length).toBeGreaterThan(10);
  });
});
