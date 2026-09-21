import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spend, costOf } from '@/services/credits/credit-service';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import { cleanup, createUser, testDb } from './helpers';

/**
 * حارس التكلفة — docs/DECISIONS.md #D-044
 *
 * `spend()` ينفّذ `decrement: cost`، وPrisma تترجم السالب إلى زيادة. تكلفة
 * سالبة في الإعدادات كانت **تمنح** المستخدم رصيداً عند كل توليد، بثلاثين
 * ريالاً للرصيد، والدفتر يسجّلها متسقة فلا شيء ينبّه.
 *
 * المدخل الإداري صار محروساً بقائمة مغلقة (اختبارات الوحدة). هنا نثبت
 * الحارس الثاني: القيمة إن وصلت من مسار آخر لا تُترجم إلى منحة.
 */

async function setCost(key: string, value: number) {
  await testDb.systemSetting.upsert({
    where: { key },
    create: { key, value, category: 'credits' },
    update: { value },
  });
  invalidateSettingsCache();
}

beforeEach(async () => {
  await cleanup();
});

afterEach(async () => {
  await testDb.systemSetting.deleteMany({ where: { key: { startsWith: 'credits.' } } });
  invalidateSettingsCache();
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe('تكلفة سالبة لا تمنح رصيداً', () => {
  it('costOf تُرجع صفراً بدل السالب', async () => {
    await setCost('credits.costs.generate', -5);
    expect(await costOf('GENERATE_LETTER')).toBe(0);
  });

  it('الرصيد لا يزيد بعد عملية بتكلفة سالبة', async () => {
    await setCost('credits.costs.generate', -5);
    const user = await createUser({ creditBalance: 3 });

    const result = await spend({
      userId: user.id,
      operation: 'GENERATE_LETTER',
      reason: 'GENERATE_LETTER',
    });

    expect(result.ok).toBe(true);

    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    // الحارس يجعلها صفراً: لا خصم ولا — وهذا المهم — منح.
    expect(after.creditBalance).toBe(3);
  });

  it('الدفتر لا يسجّل حركة موجبة كاذبة', async () => {
    await setCost('credits.costs.generate', -5);
    const user = await createUser({ creditBalance: 3 });

    await spend({
      userId: user.id,
      operation: 'GENERATE_LETTER',
      reason: 'GENERATE_LETTER',
    });

    // حركة الترحيب التي يزرعها `createUser` موجبة بطبيعتها — نستثنيها.
    const entries = await testDb.creditTransaction.findMany({
      where: { userId: user.id, reason: 'GENERATE_LETTER' },
      select: { amount: true },
    });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.amount <= 0)).toBe(true);
  });
});

describe('التكاليف المشروعة تبقى كما هي', () => {
  it('تكلفة موجبة تُخصم', async () => {
    await setCost('credits.costs.generate', 2);
    const user = await createUser({ creditBalance: 5 });

    const result = await spend({
      userId: user.id,
      operation: 'GENERATE_LETTER',
      reason: 'GENERATE_LETTER',
    });

    expect(result.ok).toBe(true);

    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    expect(after.creditBalance).toBe(3);
  });

  it('صفر مشروع — الأداة مشمولة فلا تُخصم', async () => {
    await setCost('credits.costs.aiTool', 0);
    expect(await costOf('AI_TOOL')).toBe(0);
  });
});
