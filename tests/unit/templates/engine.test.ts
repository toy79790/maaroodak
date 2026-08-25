import { describe, expect, it } from 'vitest';
import {
  extractVariables,
  render,
  validateTemplate,
} from '@/services/templates/engine';

describe('render — الاستبدال', () => {
  it('يستبدل المتغيرات', () => {
    const result = render('مرحباً {{name}} من {{city}}', {
      name: 'محمد',
      city: 'الرياض',
    });
    expect(result.output).toBe('مرحباً محمد من الرياض');
    expect(result.missing).toEqual([]);
  });

  it('يتسامح مع المسافات داخل الأقواس', () => {
    expect(render('{{ name }}', { name: 'محمد' }).output).toBe('محمد');
  });

  it('يحوّل الأرقام والقيم المنطقية', () => {
    expect(render('{{amount}} — {{ok}}', { amount: 5000, ok: true }).output).toBe(
      '5000 — نعم',
    );
  });

  it('يضع علامة نائبة مرئية للمتغير الناقص', () => {
    const result = render('رقم المعاملة: {{a.reference_number}}', {});
    expect(result.output).toContain('[أدخل reference number]');
    expect(result.missing).toEqual(['a.reference_number']);
  });

  it('يحذف الناقص في وضع empty', () => {
    const result = render('س {{missing}} ع', {}, { missing: 'empty' });
    expect(result.output).toBe('س  ع');
  });

  it('يُبقي الناقص كما هو في وضع keep', () => {
    expect(render('{{x}}', {}, { missing: 'keep' }).output).toBe('{{x}}');
  });

  it('لا يعالج متغيراً وارداً من إجابة مستخدم', () => {
    // إجابة تحتوي {{...}} يجب أن تظهر كنص لا أن تُفسَّر.
    const result = render('{{note}}', { note: '{{secret}}' });
    expect(result.output).toBe('{{secret}}');
  });
});

describe('render — الكتل الشرطية', () => {
  const template = 'قبل{{#if id}} رقم الهوية: {{id}}{{/if}} بعد';

  it('يعرض الكتلة عند وجود القيمة', () => {
    expect(render(template, { id: '1234567890' }).output).toBe(
      'قبل رقم الهوية: 1234567890 بعد',
    );
  });

  it('يحذف الكتلة عند غياب القيمة', () => {
    expect(render(template, {}).output).toBe('قبل بعد');
  });

  it('المتغير داخل كتلة محذوفة لا يُحتسب ناقصاً', () => {
    // وإلا لأنذرنا المستخدم عن معلومة اختيارية اختار ألّا يذكرها.
    expect(render(template, {}).missing).toEqual([]);
  });

  it('يدعم else', () => {
    const withElse = '{{#if phone}}جوال: {{phone}}{{else}}لا يوجد جوال{{/if}}';
    expect(render(withElse, { phone: '0512345678' }).output).toBe(
      'جوال: 0512345678',
    );
    expect(render(withElse, {}).output).toBe('لا يوجد جوال');
  });

  it('يدعم التداخل', () => {
    const nested = '{{#if a}}أ{{#if b}}ب{{/if}}{{/if}}';
    expect(render(nested, { a: '1', b: '1' }).output).toBe('أب');
    expect(render(nested, { a: '1' }).output).toBe('أ');
    expect(render(nested, {}).output).toBe('');
  });

  it('القيم الفارغة والصفرية تُعامل كغائبة', () => {
    expect(render('{{#if x}}ظاهر{{/if}}', { x: '' }).output).toBe('');
    expect(render('{{#if x}}ظاهر{{/if}}', { x: '   ' }).output).toBe('');
    expect(render('{{#if x}}ظاهر{{/if}}', { x: 0 }).output).toBe('');
    expect(render('{{#if x}}ظاهر{{/if}}', { x: false }).output).toBe('');
  });
});

describe('render — التنظيف', () => {
  it('يطوي الأسطر الفارغة الناتجة عن كتل محذوفة', () => {
    const template = 'سطر\n{{#if a}}محذوف{{/if}}\n\n\n\nسطر آخر';
    expect(render(template, {}).output).toBe('سطر\n\nسطر آخر');
  });
});

describe('extractVariables', () => {
  it('يجمع متغيرات الاستبدال والكتل', () => {
    expect(
      extractVariables('{{a}} {{#if b}}{{c}}{{/if}} {{a}}'),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('validateTemplate', () => {
  it('يقبل قالباً سليماً', () => {
    expect(validateTemplate('{{ai_body}} {{#if x}}{{x}}{{/if}}')).toEqual([]);
  });

  it('يكشف كتلة غير مغلقة', () => {
    const issues = validateTemplate('{{ai_body}} {{#if x}}نص');
    expect(issues.some((issue) => issue.type === 'unclosed_if')).toBe(true);
  });

  it('يكشف {{/if}} زائدة', () => {
    const issues = validateTemplate('{{ai_body}} نص{{/if}}');
    expect(issues.some((issue) => issue.type === 'unopened_if')).toBe(true);
  });

  it('يكشف غياب {{ai_body}}', () => {
    // بدونه لن يظهر المحتوى المُولَّد إطلاقاً — أخطر خطأ في قالب.
    const issues = validateTemplate('بسم الله {{full_name}}');
    expect(issues.some((issue) => issue.type === 'missing_ai_slot')).toBe(true);
  });

  it('يكشف متغيراً غير معروف ويتجاهل متغيرات الإجابات', () => {
    const issues = validateTemplate('{{ai_body}} {{oops}} {{a.anything}}', [
      'ai_body',
      'full_name',
    ]);
    const unknown = issues.filter((issue) => issue.type === 'unknown_variable');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.message).toContain('oops');
  });
});
