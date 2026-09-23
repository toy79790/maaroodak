import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setProvider } from '@/services/ai/providers/anthropic';
import { runAiTool } from '@/features/letters/ai-tools-service';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import { FakeLLMProvider } from '../fakes/llm-provider';
import { cleanup, createCatalog, createUser, testDb } from './helpers';

/**
 * أدوات التعديل على نص محدَّد — #D-045
 *
 * كانت تعيد بناء المعروض كله من نص مسطّح فتمسح تنسيقه، ولا تطابق تحديداً
 * يمتد على فقرتين (فيُدفع النداء ويُحتسب الاستخدام ولا يتغيّر شيء).
 */

const scope = { organizationId: null };

const FORMATTED_HTML = [
  '<h2>الموضوع: طلب جدولة</h2>',
  '<p style="text-align: center">أتقدم بطلب جدولة المديونية.</p>',
  '<p>وذلك لظروف طارئة.</p>',
  '<ul><li><p>كشف الحساب</p></li></ul>',
].join('');

let fake: FakeLLMProvider;

beforeAll(() => {
  fake = new FakeLLMProvider();
  setProvider(fake);
});

afterEach(async () => {
  fake.reset();
  fake.setBehavior({});
  invalidateSettingsCache();
  await cleanup();
});

afterAll(async () => {
  setProvider(null);
  await testDb.$disconnect();
});

async function seedLetter() {
  const user = await createUser({ creditBalance: 0 });
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
      contentHtml: FORMATTED_HTML,
      contentText: 'نص',
      userId: user.id,
      departmentId: catalog.departmentId,
      requestTypeId: catalog.requestTypeId,
      status: 'EDITED',
    },
    select: { id: true },
  });

  return { user, letter };
}

describe('أدوات التعديل على تحديد', () => {
  it('تطابق تحديداً على فقرتين وتُبقي تنسيق باقي المعروض', async () => {
    fake.setBehavior({ text: 'ألتمس جدولة المديونية لظروف طارئة.' });
    const { user, letter } = await seedLetter();

    // كما يرسله المحرر: سطر واحد بين الفقرتين.
    const result = await runAiTool(user.id, scope, letter.id, {
      tool: 'IMPROVE',
      selection: 'أتقدم بطلب جدولة المديونية.\nوذلك لظروف طارئة.',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data.contentHtml ?? '';
    expect(html).toContain('<h2>الموضوع: طلب جدولة</h2>');
    expect(html).toContain('<p style="text-align: center">ألتمس جدولة المديونية لظروف طارئة.</p>');
    expect(html).toContain('<ul><li><p>كشف الحساب</p></li></ul>');
    expect(html).not.toContain('وذلك');

    const version = await testDb.letterVersion.findFirst({
      where: { letterId: letter.id, source: 'AI_TOOL' },
    });
    expect(version).not.toBeNull();
  });

  it('ترفض تحديداً غير موجود قبل نداء النموذج، ولا تحتسبه', async () => {
    fake.setBehavior({ text: 'أي نص' });
    const { user, letter } = await seedLetter();

    const result = await runAiTool(user.id, scope, letter.id, {
      tool: 'IMPROVE',
      selection: 'نص لم يعد في المعروض',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(fake.textRequests).toHaveLength(0);
    expect(
      await testDb.creditTransaction.count({ where: { referenceId: letter.id } }),
    ).toBe(0);
  });
});
