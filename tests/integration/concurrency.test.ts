import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setProvider } from '@/services/ai/providers/anthropic';
import { runAiTool } from '@/features/letters/ai-tools-service';
import { updateLetter } from '@/features/letters/service';
import { updateUser } from '@/features/admin/service';
import { reconcile } from '@/services/credits/credit-service';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import type { LLMProvider } from '@/services/ai/ports';
import { FakeLLMProvider } from '../fakes/llm-provider';
import { cleanup, createCatalog, createUser, testDb } from './helpers';

/**
 * سباقات التزامن — docs/DECISIONS.md #D-046
 *
 * كل ما هنا كان يمرّ في الاختبار التسلسلي ويفشل تحت طلبات متزامنة.
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
  await testDb.auditLog.deleteMany({});
  invalidateSettingsCache();
  await cleanup();
});

afterAll(async () => {
  setProvider(null);
  await testDb.$disconnect();
});

async function seedLetter(credits = 0) {
  const user = await createUser({ creditBalance: credits });
  const catalog = await createCatalog();

  await testDb.prompt.create({
    data: {
      key: `improve-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'تحسين',
      type: 'TOOL_IMPROVE',
      content: 'حسّن الصياغة.',
    },
  });

  const letter = await testDb.letter.create({
    data: {
      title: 'طلب جدولة',
      contentHtml: '<p>أتقدم بطلب جدولة المديونية.</p>',
      contentText: 'أتقدم بطلب جدولة المديونية.',
      userId: user.id,
      departmentId: catalog.departmentId,
      requestTypeId: catalog.requestTypeId,
      status: 'GENERATED',
    },
    select: { id: true },
  });

  return { user, letter };
}

describe('حد أدوات الذكاء الاصطناعي تحت التزامن', () => {
  it('خمسة طلبات متزامنة وحدّ ٢ ⇒ ينجح اثنان فقط', async () => {
    await testDb.systemSetting.upsert({
      where: { key: 'credits.aiToolsPerLetter' },
      create: { key: 'credits.aiToolsPerLetter', value: 2, category: 'credits' },
      update: { value: 2 },
    });
    invalidateSettingsCache();
    fake.setBehavior({ text: 'ألتمس جدولة المديونية.' });
    const { user, letter } = await seedLetter();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        runAiTool(user.id, scope, letter.id, { tool: 'IMPROVE' }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(
      results.filter((result) => !result.ok && result.error.code === 'QUOTA_EXCEEDED'),
    ).toHaveLength(3);
    // المرفوض لم يصل إلى النموذج أصلاً.
    expect(fake.textRequests).toHaveLength(2);

    const row = await testDb.letter.findUniqueOrThrow({
      where: { id: letter.id },
      select: { aiToolUses: true },
    });
    expect(row.aiToolUses).toBe(2);
  });

  it('فشل النداء يُفلت الحجز فلا يُحتسب', async () => {
    const { user, letter } = await seedLetter();
    const { LLMError } = await import('@/services/ai/ports');
    fake.setBehavior({ error: new LLMError('timeout', 'انتهت المهلة') });

    const result = await runAiTool(user.id, scope, letter.id, { tool: 'IMPROVE' });

    expect(result.ok).toBe(false);
    const row = await testDb.letter.findUniqueOrThrow({
      where: { id: letter.id },
      select: { aiToolUses: true },
    });
    expect(row.aiToolUses).toBe(0);
  });

  it('التعديل والخصم في معاملة واحدة: رصيد غير كافٍ ⇒ لا تعديل', async () => {
    await testDb.systemSetting.upsert({
      where: { key: 'credits.costs.aiTool' },
      create: { key: 'credits.costs.aiTool', value: 1, category: 'credits' },
      update: { value: 1 },
    });
    invalidateSettingsCache();
    fake.setBehavior({ text: 'نص جديد تماماً.' });
    // رصيد ١ وطلبان متزامنان بتكلفة ١: كلاهما يجتاز الفحص المسبق.
    const { user, letter } = await seedLetter(1);

    const results = await Promise.all([
      runAiTool(user.id, scope, letter.id, { tool: 'IMPROVE' }),
      runAiTool(user.id, scope, letter.id, { tool: 'IMPROVE' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);

    const versions = await testDb.letterVersion.count({
      where: { letterId: letter.id, source: 'AI_TOOL' },
    });
    // نسخة واحدة فقط — المرفوض لم يترك تعديلاً مجانياً.
    expect(versions).toBe(1);

    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    expect(after.creditBalance).toBe(0);
  });
});

describe('أداة AI وحفظ في أثناء النداء (#D-047)', () => {
  it('لا تكتب فوق ما حُفظ أثناء النداء، ولا تُحتسب', async () => {
    const { user, letter } = await seedLetter();
    const manualHtml = '<p>حفظ يدوي في أثناء النداء.</p>';

    // مزوّد يحفظ المعروض يدوياً قبل أن يردّ — كأن المستخدم حفظ من نافذة أخرى.
    const racing: LLMProvider = {
      name: 'racing',
      isConfigured: true,
      generateText: async (request) => {
        await updateLetter(user.id, letter.id, { contentHtml: manualHtml });
        return fake.generateText(request);
      },
      generateStructured: (request, schema, schemaName) =>
        fake.generateStructured(request, schema, schemaName),
    };
    fake.setBehavior({ text: 'ناتج الأداة.' });
    setProvider(racing);

    try {
      const result = await runAiTool(user.id, scope, letter.id, { tool: 'IMPROVE' });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONFLICT');
    } finally {
      setProvider(fake);
    }

    const row = await testDb.letter.findUniqueOrThrow({
      where: { id: letter.id },
      select: { contentHtml: true, aiToolUses: true },
    });
    expect(row.contentHtml).toBe(manualHtml);
    expect(row.aiToolUses).toBe(0);

    // النداء دُفع ولم يُستخدم — مسجَّل للمحاسبة.
    const orphaned = await testDb.aIUsage.count({
      where: { letterId: letter.id, status: 'ORPHANED' },
    });
    expect(orphaned).toBe(1);
  });
});

describe('updateLetter تحت التزامن', () => {
  it('تعديلان متزامنان ⇒ نسختان متتاليتان بلا تصادم', async () => {
    const { user, letter } = await seedLetter();

    const results = await Promise.all([
      updateLetter(user.id, letter.id, { contentHtml: '<p>النسخة أ</p>' }),
      updateLetter(user.id, letter.id, { contentHtml: '<p>النسخة ب</p>' }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);

    const versions = await testDb.letterVersion.findMany({
      where: { letterId: letter.id },
      select: { version: true },
      orderBy: { version: 'asc' },
    });
    expect(versions.map((row) => row.version)).toEqual([2, 3]);

    const row = await testDb.letter.findUniqueOrThrow({
      where: { id: letter.id },
      select: { currentVersion: true },
    });
    expect(row.currentVersion).toBe(3);
  });
});

describe('تعديل الرصيد من لوحة الإدارة', () => {
  it('سحب أكبر من الرصيد يسحب المتاح ويسجّله فعلاً', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    const target = await createUser({ creditBalance: 2 });

    const result = await updateUser({ actorId: admin.id }, target.id, {
      creditAdjustment: -5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.creditBalance).toBe(0);

    const ledger = await testDb.creditTransaction.findMany({
      where: { userId: target.id, reason: 'ADMIN_ADJUST' },
      select: { amount: true, balanceAfter: true },
    });
    expect(ledger).toEqual([{ amount: -2, balanceAfter: 0 }]);
  });

  it('سحب ومنحة متزامنان لا يمسح أحدهما الآخر، والدفتر يطابق الرصيد', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    const target = await createUser({ creditBalance: 2 });
    // createUser يكتب حركة افتتاحية بالرصيد، فالدفتر يبدأ متسقاً.

    await Promise.all([
      updateUser({ actorId: admin.id }, target.id, { creditAdjustment: -5 }),
      updateUser({ actorId: admin.id }, target.id, { creditAdjustment: 30 }),
    ]);

    const { stored, drift } = await reconcile(target.id);
    // أيّاً كان الترتيب: لا انحراف بين الرصيد والدفتر، والمنحة لم تُمسح.
    expect(drift).toBe(0);
    expect([27, 30]).toContain(stored);
  });

  it('سحب من رصيد صفر لا يكتب حركة', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    const target = await createUser({ creditBalance: 0 });

    const result = await updateUser({ actorId: admin.id }, target.id, {
      creditAdjustment: -3,
    });

    expect(result.ok).toBe(true);
    expect(
      await testDb.creditTransaction.count({
        where: { userId: target.id, reason: 'ADMIN_ADJUST' },
      }),
    ).toBe(0);
  });
});
