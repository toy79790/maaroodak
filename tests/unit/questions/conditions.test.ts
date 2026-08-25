import { describe, expect, it } from 'vitest';
import {
  detectCycle,
  evaluateClause,
  evaluateRule,
  isEmptyValue,
} from '@/services/questions/conditions';
import { clause, makeRule } from '../../factories/questions';
import type { AnswerMap } from '@/types/questions';

const alwaysVisible = () => true;

describe('isEmptyValue', () => {
  it('يعتبر null و undefined والنص الفارغ والمصفوفة الفارغة فارغة', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue('   ')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
  });

  it('لا يعتبر false أو 0 فارغة', () => {
    // خطأ شائع: معاملة false كـ«لا إجابة» يُفقد إجابة «لا» الصريحة.
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
  });
});

describe('evaluateClause — العوامل', () => {
  const answers: AnswerMap = {
    name: 'محمد',
    amount: 5000,
    yes: true,
    no: false,
    empty: '',
    tags: ['a', 'b'],
    arabicNumber: '٥٠٠٠',
  };


  it('EQUALS / NOT_EQUALS', () => {
    expect(evaluateClause(clause('name', 'EQUALS', 'محمد'), answers)).toBe(true);
    expect(evaluateClause(clause('name', 'EQUALS', 'أحمد'), answers)).toBe(false);
    expect(evaluateClause(clause('name', 'NOT_EQUALS', 'أحمد'), answers)).toBe(true);
  });

  it('EQUALS يوحّد صور الهمزة والألف', () => {
    expect(evaluateClause(clause('name', 'EQUALS', 'محمد'), { name: 'محمد' })).toBe(
      true,
    );
    expect(
      evaluateClause(clause('city', 'EQUALS', 'الاحساء'), { city: 'الأحساء' }),
    ).toBe(true);
  });

  it('EQUALS يقارن نعم/لا منطقياً حتى لو كُتب المتوقع نصاً', () => {
    expect(evaluateClause(clause('yes', 'EQUALS', 'نعم'), answers)).toBe(true);
    expect(evaluateClause(clause('yes', 'EQUALS', 'true'), answers)).toBe(true);
    expect(evaluateClause(clause('no', 'EQUALS', 'لا'), answers)).toBe(true);
    expect(evaluateClause(clause('no', 'EQUALS', 'نعم'), answers)).toBe(false);
  });

  it('IS_TRUE / IS_FALSE', () => {
    expect(evaluateClause(clause('yes', 'IS_TRUE'), answers)).toBe(true);
    expect(evaluateClause(clause('no', 'IS_TRUE'), answers)).toBe(false);
    expect(evaluateClause(clause('no', 'IS_FALSE'), answers)).toBe(true);
    // قيمة غير موجودة ليست true ولا false
    expect(evaluateClause(clause('missing', 'IS_TRUE'), answers)).toBe(false);
    expect(evaluateClause(clause('missing', 'IS_FALSE'), answers)).toBe(false);
  });

  it('IS_EMPTY / IS_NOT_EMPTY', () => {
    expect(evaluateClause(clause('empty', 'IS_EMPTY'), answers)).toBe(true);
    expect(evaluateClause(clause('name', 'IS_NOT_EMPTY'), answers)).toBe(true);
    expect(evaluateClause(clause('no', 'IS_EMPTY'), answers)).toBe(false);
  });

  it('المقارنات العددية تعمل على النصوص والأرقام العربية', () => {
    expect(evaluateClause(clause('amount', 'GT', 1000), answers)).toBe(true);
    expect(evaluateClause(clause('amount', 'GTE', 5000), answers)).toBe(true);
    expect(evaluateClause(clause('amount', 'LT', 1000), answers)).toBe(false);
    expect(evaluateClause(clause('amount', 'LTE', 5000), answers)).toBe(true);

    // «١٠» > «٩» يجب أن تُقارن كأرقام لا كنصوص
    expect(evaluateClause(clause('n', 'GT', 9), { n: '10' })).toBe(true);
    expect(evaluateClause(clause('arabicNumber', 'GT', 1000), answers)).toBe(true);
    expect(evaluateClause(clause('n', 'GT', 1000), { n: '10,000' })).toBe(true);
  });

  it('المقارنة العددية على قيمة غير رقمية ترجع false لا تُلقي خطأ', () => {
    expect(evaluateClause(clause('name', 'GT', 5), answers)).toBe(false);
  });

  it('IN / NOT_IN', () => {
    expect(evaluateClause(clause('name', 'IN', ['محمد', 'أحمد']), answers)).toBe(true);
    expect(evaluateClause(clause('name', 'NOT_IN', ['سعد']), answers)).toBe(true);
    expect(evaluateClause(clause('missing', 'IN', ['a']), answers)).toBe(false);
  });

  it('CONTAINS على المصفوفات = عضوية، وعلى النصوص = احتواء جزئي', () => {
    expect(evaluateClause(clause('tags', 'CONTAINS', 'a'), answers)).toBe(true);
    expect(evaluateClause(clause('tags', 'CONTAINS', 'z'), answers)).toBe(false);
    expect(evaluateClause(clause('name', 'CONTAINS', 'حم'), answers)).toBe(true);
    expect(evaluateClause(clause('name', 'NOT_CONTAINS', 'زيد'), answers)).toBe(true);
  });

  it('لا يتحقق أي بند إذا كان سؤال المصدر مخفياً', () => {
    // انتشار الإخفاء: لا يظهر حفيد لشرط مبني على إجابة لم تعد مرئية.
    expect(evaluateClause(clause('yes', 'IS_TRUE'), answers, false)).toBe(false);
    expect(evaluateClause(clause('empty', 'IS_EMPTY'), answers, false)).toBe(false);
  });

});

describe('evaluateRule — AND / OR', () => {
  const answers: AnswerMap = { a: true, b: false, n: 10 };

  it('AND يتطلب تحقق كل البنود', () => {
    const rule = makeRule('target', [
      clause('a', 'IS_TRUE'),
      clause('n', 'GT', 5),
    ]);
    expect(evaluateRule(rule, answers, alwaysVisible)).toBe(true);

    const failing = makeRule('target', [
      clause('a', 'IS_TRUE'),
      clause('n', 'GT', 50),
    ]);
    expect(evaluateRule(failing, answers, alwaysVisible)).toBe(false);
  });

  it('OR يكفيه بند واحد', () => {
    const rule = makeRule(
      'target',
      [clause('b', 'IS_TRUE'), clause('n', 'GT', 5)],
      { logic: 'OR' },
    );
    expect(evaluateRule(rule, answers, alwaysVisible)).toBe(true);
  });

  it('قاعدة بلا بنود لا تتحقق', () => {
    expect(evaluateRule(makeRule('target', []), answers, alwaysVisible)).toBe(false);
  });
});

describe('detectCycle', () => {
  it('لا يجد دورة في سلسلة مستقيمة', () => {
    const rules = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('c', [clause('b', 'IS_TRUE')]),
      makeRule('d', [clause('c', 'IS_TRUE')]),
    ];
    expect(detectCycle(rules).hasCycle).toBe(false);
  });

  it('يكشف دورة مباشرة', () => {
    const rules = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('a', [clause('b', 'IS_TRUE')]),
    ];
    const result = detectCycle(rules);
    expect(result.hasCycle).toBe(true);
    expect(result.path.length).toBeGreaterThan(1);
  });

  it('يكشف دورة غير مباشرة', () => {
    const rules = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('c', [clause('b', 'IS_TRUE')]),
      makeRule('a', [clause('c', 'IS_TRUE')]),
    ];
    expect(detectCycle(rules).hasCycle).toBe(true);
  });

  it('يكشف حلقة ذاتية', () => {
    expect(detectCycle([makeRule('a', [clause('a', 'IS_TRUE')])]).hasCycle).toBe(
      true,
    );
  });
});
