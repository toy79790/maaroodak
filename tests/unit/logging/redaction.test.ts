import { describe, expect, it } from 'vitest';
import { redact } from '@/lib/logging/logger';

/**
 * التعقيم أهم من كونه ميزة: تسريب كلمة مرور أو رقم هوية في سجل يعني
 * انتشارها إلى كل نظام يجمع السجلات، ولا سبيل لسحبها بعدها.
 */

const asRecord = (value: unknown) => value as Record<string, unknown>;

describe('redact — الحقول الحساسة', () => {
  it('يحجب كلمات المرور بكل صيغها', () => {
    const output = asRecord(
      redact({
        password: 'secret123',
        passwordHash: '$2b$12$abc',
        userPassword: 'x',
        user_password: 'y',
      }),
    );

    expect(output.password).toBe('[محجوب]');
    expect(output.passwordHash).toBe('[محجوب]');
    expect(output.userPassword).toBe('[محجوب]');
    expect(output.user_password).toBe('[محجوب]');
  });

  it('يحجب المفاتيح والرموز', () => {
    const output = asRecord(
      redact({
        apiKey: 'sk-ant-123',
        api_key: 'sk-ant-456',
        ANTHROPIC_API_KEY: 'sk-ant-789',
        token: 'abc',
        authorization: 'Bearer x',
        cookie: 'session=y',
      }),
    );

    for (const value of Object.values(output)) {
      expect(value).toBe('[محجوب]');
    }
  });

  it('يحجب البيانات الشخصية الحساسة', () => {
    const output = asRecord(
      redact({ nationalId: '1012345678', national_id: '1012345678', iban: 'SA03', cvv: '123' }),
    );

    for (const value of Object.values(output)) {
      expect(value).toBe('[محجوب]');
    }
  });

  it('يحجب محتوى المعاريض وإجابات المستخدم', () => {
    // هذه ظروف مالية وصحية شخصية — لا مكان لها في أي سجل.
    const output = asRecord(
      redact({
        contentHtml: '<p>مديونية 85000</p>',
        contentText: 'مديونية 85000',
        answers: { debt_amount: 85000 },
        prompt: 'تعليمات النموذج',
      }),
    );

    for (const value of Object.values(output)) {
      expect(value).toBe('[محجوب]');
    }
  });

  it('يحجب داخل الكائنات المتداخلة', () => {
    const output = asRecord(
      redact({ user: { id: 'u1', name: 'محمد', password: 'secret' } }),
    );

    const user = asRecord(output.user);
    expect(user.password).toBe('[محجوب]');
    // ما ليس حساساً يبقى — السجل بلا معلومات لا قيمة له.
    expect(user.id).toBe('u1');
    expect(user.name).toBe('محمد');
  });

  it('يحجب داخل المصفوفات', () => {
    const output = redact([{ token: 'a' }, { token: 'b' }]) as Array<Record<string, unknown>>;
    expect(output[0]?.token).toBe('[محجوب]');
    expect(output[1]?.token).toBe('[محجوب]');
  });
});

describe('redact — السلامة التشغيلية', () => {
  it('يحتفظ بالحقول غير الحساسة', () => {
    const output = asRecord(
      redact({ userId: 'u1', scope: 'ai', durationMs: 120, model: 'claude-opus-5' }),
    );

    expect(output.userId).toBe('u1');
    expect(output.scope).toBe('ai');
    expect(output.durationMs).toBe(120);
    expect(output.model).toBe('claude-opus-5');
  });

  it('يحوّل الأخطاء إلى شكل قابل للتسلسل', () => {
    const output = asRecord(redact(new Error('فشل الاتصال')));
    expect(output.name).toBe('Error');
    expect(output.message).toBe('فشل الاتصال');
  });

  it('لا يدور إلى ما لا نهاية على البنى الدائرية', () => {
    const circular: Record<string, unknown> = { name: 'a' };
    circular.self = circular;

    // لا انفجار مكدّس — الحدّ العمقي يقطع الدوران.
    expect(() => redact(circular)).not.toThrow();
  });

  it('يقصّ النصوص الطويلة جداً', () => {
    const output = redact('x'.repeat(5000)) as string;
    expect(output.length).toBeLessThan(2100);
    expect(output.endsWith('…')).toBe(true);
  });

  it('يحدّ من طول المصفوفات', () => {
    const output = redact(Array.from({ length: 100 }, (_, i) => i)) as unknown[];
    expect(output.length).toBeLessThanOrEqual(20);
  });

  it('يمرّر القيم الفارغة كما هي', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});
