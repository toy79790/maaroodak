import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setProvider } from '@/services/ai/providers/anthropic';
import { generateLetter } from '@/features/letters/generate-service';
import { invalidateSettingsCache } from '@/lib/db/repositories/settings-repository';
import { FakeLLMProvider, passingQualityReport } from '../fakes/llm-provider';
import {
  cleanup,
  createCatalog,
  createQuestion,
  createSession,
  createUser,
  testDb,
} from './helpers';

/**
 * اختبار تكامل لمسار التوليد الكامل — docs/TESTING.md §2.6
 *
 * يغطي ما لا تستطيع اختبارات الوحدة إثباته: أن الخدمات والقاعدة والرصيد
 * وتتبّع الاستهلاك تعمل معاً في معاملة واحدة صحيحة.
 */

const scope = { organizationId: null };

const LETTER_BODY = `أتقدم إلى معاليكم بطلب جدولة مديونية قدرها 85000 ريال لدى بنك الرياض.
انقطع دخلي بعد إنهاء خدماتي، وتعذّر عليّ سداد الأقساط المستحقة.
وعليه ألتمس من معاليكم التكرم بالنظر في جدولة هذه المديونية بما يتناسب مع وضعي الحالي.`;

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

async function seedScenario(options: { credits?: number } = {}) {
  const user = await createUser({ creditBalance: options.credits ?? 5 });
  const catalog = await createCatalog();

  await createQuestion({
    key: 'debt_amount',
    label: 'قيمة المديونية',
    type: 'NUMBER',
    order: 10,
    requestTypeId: catalog.requestTypeId,
  });
  await createQuestion({
    key: 'creditor_name',
    label: 'الجهة الدائنة',
    order: 11,
    requestTypeId: catalog.requestTypeId,
  });

  const sessionId = await createSession({
    userId: user.id,
    departmentId: catalog.departmentId,
    requestTypeId: catalog.requestTypeId,
    answers: { debt_amount: 85000, creditor_name: 'بنك الرياض' },
  });

  return { user, catalog, sessionId };
}

describe('generateLetter — المسار الناجح', () => {
  it('ينشئ معروضاً ونسخة وحركة رصيد وسجل استهلاك في معاملة واحدة', async () => {
    fake.setBehavior({ text: LETTER_BODY, structured: passingQualityReport() });

    const { user, sessionId } = await seedScenario({ credits: 5 });
    const result = await generateLetter(user.id, scope, sessionId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // المعروض
    const letter = await testDb.letter.findUniqueOrThrow({
      where: { id: result.data.letter.id },
      select: {
        contentHtml: true,
        contentText: true,
        status: true,
        currentVersion: true,
        answers: true,
      },
    });

    expect(letter.status).toBe('GENERATED');
    expect(letter.currentVersion).toBe(1);
    // القالب رُندر حول مخرَج الذكاء الاصطناعي.
    expect(letter.contentText).toContain('بسم الله الرحمن الرحيم');
    expect(letter.contentText).toContain('معالي وزير الاختبار');
    expect(letter.contentText).toContain('85000');
    // لا رموز قالب متبقية.
    expect(letter.contentHtml).not.toContain('{{');

    // النسخة الأولى
    const versions = await testDb.letterVersion.findMany({
      where: { letterId: result.data.letter.id },
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]?.source).toBe('AI_GENERATED');

    // الخصم
    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    expect(after.creditBalance).toBe(4);
    expect(result.data.creditBalance).toBe(4);

    const ledger = await testDb.creditTransaction.findFirst({
      where: { userId: user.id, reason: 'GENERATE_LETTER' },
    });
    expect(ledger?.amount).toBe(-1);
    expect(ledger?.balanceAfter).toBe(4);

    // تتبّع الاستهلاك: نداء توليد + نداء فحص جودة.
    const usage = await testDb.aIUsage.findMany({
      where: { letterId: result.data.letter.id },
    });
    expect(usage.length).toBeGreaterThanOrEqual(2);
    expect(usage.every((row) => row.status === 'SUCCESS')).toBe(true);
    expect(Number(usage[0]?.costUsd)).toBeGreaterThan(0);

    // الجلسة تحوّلت
    const session = await testDb.interviewSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { status: true, letterId: true },
    });
    expect(session.status).toBe('CONVERTED');
    expect(session.letterId).toBe(result.data.letter.id);
  });

  it('يبني الـ Prompt بالطبقات الصحيحة ويغلّف الحقائق', async () => {
    fake.setBehavior({ text: LETTER_BODY, structured: passingQualityReport() });

    const { user, sessionId } = await seedScenario();
    await generateLetter(user.id, scope, sessionId);

    const system = fake.lastSystemTexts();
    // L1 الضوابط أولاً دائماً — ثبات البادئة شرط للتخزين المؤقت.
    expect(system[0]).toContain('لا تخترع أي معلومة');
    expect(system.join('\n')).toContain('اكتب بأسلوب رسمي مختصر');

    const prompt = fake.lastUserPrompt();
    expect(prompt).toContain('<user_facts>');
    expect(prompt).toContain('بنك الرياض');
    expect(prompt).toContain('85000');
  });
});

describe('generateLetter — مسارات الفشل', () => {
  it('لا يخصم رصيداً ولا ينشئ معروضاً عند فشل الذكاء الاصطناعي', async () => {
    const { user, sessionId } = await seedScenario({ credits: 3 });

    const { LLMError } = await import('@/services/ai/ports');
    fake.setBehavior({ error: new LLMError('timeout', 'انتهت المهلة') });

    const result = await generateLetter(user.id, scope, sessionId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AI_FAILED');

    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    // القاعدة الحاكمة: فشل الذكاء الاصطناعي = لا خصم.
    expect(after.creditBalance).toBe(3);
    expect(await testDb.letter.count()).toBe(0);

    // لكن الفشل مُسجَّل — معدل الفشل مقياس بذاته.
    const usage = await testDb.aIUsage.findFirst({ where: { userId: user.id } });
    expect(usage?.status).toBe('TIMEOUT');
  });

  it('يرفض التوليد قبل أي نداء عند نفاد الرصيد', async () => {
    const { user, sessionId } = await seedScenario({ credits: 0 });

    const result = await generateLetter(user.id, scope, sessionId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INSUFFICIENT_CREDITS');
    // الأهم: لم يُستدعَ المزوّد إطلاقاً.
    expect(fake.textRequests).toHaveLength(0);
  });

  it('يعيد AI_BLOCKED عند رفض النموذج', async () => {
    fake.setBehavior({ refuse: true });
    const { user, sessionId } = await seedScenario({ credits: 3 });

    const result = await generateLetter(user.id, scope, sessionId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AI_BLOCKED');

    const after = await testDb.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    expect(after.creditBalance).toBe(3);
  });

  it('يمنع الوصول إلى مقابلة مستخدم آخر', async () => {
    fake.setBehavior({ text: LETTER_BODY });
    const { sessionId } = await seedScenario();
    const intruder = await createUser();

    const result = await generateLetter(intruder.id, scope, sessionId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 404 لا 403 — لا نؤكد وجود المورد لمن لا يملكه.
    expect(result.error.code).toBe('NOT_FOUND');
  });
});

describe('generateLetter — الضوابط', () => {
  it('يعيد التوليد مرة واحدة عند اختراع أرقام، ويأخذ الأفضل', async () => {
    // المحاولة الأولى تخترع رقماً؛ الثانية نظيفة.
    fake.setBehavior({
      text: (_request, index) =>
        index === 0
          ? 'مديونية قدرها 999999 ريال لدى بنك الرياض، ورقم المعاملة 4412876.'
          : LETTER_BODY,
      structured: passingQualityReport(),
    });

    const { user, sessionId } = await seedScenario();
    const result = await generateLetter(user.id, scope, sessionId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fake.textRequests).toHaveLength(2);
    // التحذير في المحاولة الثانية يُمرَّر للنموذج.
    expect(fake.textRequests[1]?.user).toContain('تنبيه من محاولة سابقة');
    // المخرَج النهائي هو النظيف.
    expect(result.data.letter.contentHtml).not.toContain('999999');
    expect(result.data.guardrails.shouldRegenerate).toBe(false);
  });

  it('يعرض المعروض مع تنبيه حين يفشل فحص الجودة', async () => {
    fake.setBehavior({ text: LETTER_BODY, structured: undefined });

    const { user, sessionId } = await seedScenario();
    const result = await generateLetter(user.id, scope, sessionId);

    // فشل الفحص لا يحجب المعروض — إضافة لا شرط.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.qualityReport).toBeNull();
    expect(result.data.letter.contentHtml.length).toBeGreaterThan(0);
  });
});
