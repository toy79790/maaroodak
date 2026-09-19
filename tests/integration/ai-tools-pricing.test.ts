import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setProvider } from '@/services/ai/providers/anthropic';
import { runAiTool } from '@/features/letters/ai-tools-service';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import { AI_TOOLS_PER_LETTER } from '@/config/constants';
import { FakeLLMProvider } from '../fakes/llm-provider';
import { cleanup, createCatalog, createUser, testDb } from './helpers';

/**
 * التسعير لكل معروض — docs/DECISIONS.md #D-042
 *
 * الأدوات مشمولة مع المعروض المدفوع بحد لكل معروض، والحد يُفرض **قبل** نداء
 * النموذج (التكلفة تقع عند النداء). وقيم لوحة الإدارة تسري فعلاً — كانت
 * تُحفظ ولا يقرؤها أحد.
 */

const scope = { organizationId: null };

let fake: FakeLLMProvider;

beforeAll(() => {
  fake = new FakeLLMProvider();
  setProvider(fake);
});

afterEach(async () => {
  fake.reset();
  fake.setBehavior({});
  await testDb.systemSetting.deleteMany({ where: { key: { startsWith: 'credits.' } } });
  invalidateSettingsCache();
  await cleanup();
});

afterAll(async () => {
  setProvider(null);
  await testDb.$disconnect();
});

async function setSetting(key: string, value: number) {
  await testDb.systemSetting.upsert({
    where: { key },
    create: { key, value, category: 'credits' },
    update: { value },
  });
  invalidateSettingsCache();
}

/** مستخدم + معروض مولَّد + موجّه أداة العنوان (أداة اقتراح لا تعدّل النص). */
async function seedLetter(credits = 0) {
  const user = await createUser({ creditBalance: credits });
  const catalog = await createCatalog();

  await testDb.prompt.create({
    data: {
      key: `title-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'عنوان',
      type: 'TOOL_TITLE',
      content: 'اقترح ثلاثة عناوين.',
    },
  });

  const letter = await createLetterFor(user.id, catalog);
  return { user, catalog, letter };
}

async function createLetterFor(
  userId: string,
  catalog: { departmentId: string; requestTypeId: string },
) {
  return testDb.letter.create({
    data: {
      title: 'طلب جدولة',
      contentHtml: '<p>أتقدم بطلب جدولة المديونية.</p>',
      contentText: 'أتقدم بطلب جدولة المديونية.',
      userId,
      departmentId: catalog.departmentId,
      requestTypeId: catalog.requestTypeId,
      status: 'GENERATED',
    },
    select: { id: true },
  });
}

const TITLES = 'طلب جدولة مديونية\nالتماس جدولة الأقساط\nطلب تسوية دين';

describe('أدوات الذكاء الاصطناعي — مشمولة مع المعروض', () => {
  it('لا تخصم رصيداً، وتُسجَّل في الدفتر بمبلغ صفر', async () => {
    fake.setBehavior({ text: TITLES });
    // رصيد صفر عمداً: المعروض مدفوع سلفاً، والأداة لا تحتاج رصيداً إضافياً.
    const { user, letter } = await seedLetter(0);

    const result = await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suggestions?.length).toBeGreaterThan(0);
    expect(result.data.creditBalance).toBe(0);
    expect(result.data.toolsRemaining).toBe(AI_TOOLS_PER_LETTER - 1);

    const ledger = await testDb.creditTransaction.findMany({
      where: { userId: user.id, reason: 'AI_TOOL' },
      select: { amount: true, referenceId: true },
    });
    expect(ledger).toEqual([{ amount: 0, referenceId: letter.id }]);
  });

  it('تُرفض بعد استنفاد الحد — قبل نداء النموذج', async () => {
    fake.setBehavior({ text: TITLES });
    await setSetting('credits.aiToolsPerLetter', 2);
    const { user, letter } = await seedLetter(0);

    for (let i = 0; i < 2; i += 1) {
      const ok = await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' });
      expect(ok.ok).toBe(true);
    }
    const callsBefore = fake.textRequests.length;

    const blocked = await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' });

    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe('QUOTA_EXCEEDED');
    expect(blocked.error.message).toContain('يدوياً');
    expect(fake.textRequests.length).toBe(callsBefore);
  });

  it('الحد لكل معروض لا لكل مستخدم', async () => {
    fake.setBehavior({ text: TITLES });
    await setSetting('credits.aiToolsPerLetter', 1);
    const { user, catalog, letter } = await seedLetter(0);

    expect((await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' })).ok).toBe(true);
    expect((await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' })).ok).toBe(false);

    const second = await createLetterFor(user.id, catalog);
    const onSecond = await runAiTool(user.id, scope, second.id, { tool: 'TITLE' });
    expect(onSecond.ok).toBe(true);
  });

  it('تكلفة الأداة من إعدادات الإدارة تسري فعلاً', async () => {
    fake.setBehavior({ text: TITLES });
    await setSetting('credits.costs.aiTool', 1);
    const { user, letter } = await seedLetter(3);

    const result = await runAiTool(user.id, scope, letter.id, { tool: 'TITLE' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.creditBalance).toBe(2);
  });
});
