import { describe, expect, it } from 'vitest';
import {
  buildSteps,
  computeState,
  dedupeByScope,
  nextStepIndex,
  visibleAnswers,
} from '@/services/questions/engine';
import {
  clause,
  debtScenario,
  makeQuestion,
  makeRule,
  makeSelect,
  makeYesNo,
} from '../../factories/questions';
import type { AnswerMap } from '@/types/questions';

const keysOf = (questions: { key: string }[]) => questions.map((q) => q.key);

describe('dedupeByScope', () => {
  it('يُبقي الأخص عند تكرار المفتاح', () => {
    const generic = makeQuestion({
      key: 'city',
      label: 'المدينة',
      scopeSpecificity: 0,
      order: 5,
    });
    const specific = makeQuestion({
      key: 'city',
      label: 'مدينة العقار',
      scopeSpecificity: 3,
      order: 5,
    });

    const result = dedupeByScope([generic, specific]);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('مدينة العقار');
  });

  it('يرتّب حسب order', () => {
    const result = dedupeByScope([
      makeQuestion({ key: 'c', order: 3 }),
      makeQuestion({ key: 'a', order: 1 }),
      makeQuestion({ key: 'b', order: 2 }),
    ]);
    expect(keysOf(result)).toEqual(['a', 'b', 'c']);
  });
});

describe('computeState — الأساسيات', () => {
  it('حالة فارغة عند غياب الأسئلة', () => {
    const state = computeState({ questions: [], conditions: [], answers: {} });
    expect(state.totalSteps).toBe(0);
    expect(state.isComplete).toBe(true);
    expect(state.progress).toBe(1);
  });

  it('يعرض الأسئلة العامة بلا شروط', () => {
    const questions = [
      makeQuestion({ key: 'a', order: 1 }),
      makeQuestion({ key: 'b', order: 2 }),
    ];
    const state = computeState({ questions, conditions: [], answers: {} });
    expect(keysOf(state.visible)).toEqual(['a', 'b']);
    expect(state.totalSteps).toBe(2);
    expect(state.isComplete).toBe(false);
  });

  it('missingRequired يشمل المطلوب المرئي غير المُجاب فقط', () => {
    const questions = [
      makeQuestion({ key: 'a', required: true, order: 1 }),
      makeQuestion({ key: 'b', required: false, order: 2 }),
      makeQuestion({ key: 'c', required: true, order: 3 }),
    ];
    const state = computeState({
      questions,
      conditions: [],
      answers: { a: 'قيمة' },
    });
    expect(keysOf(state.missingRequired)).toEqual(['c']);
    expect(state.answeredCount).toBe(1);
  });

  it('يكتمل عند الإجابة على كل المطلوب', () => {
    const questions = [
      makeQuestion({ key: 'a', order: 1 }),
      makeQuestion({ key: 'b', required: false, order: 2 }),
    ];
    const state = computeState({
      questions,
      conditions: [],
      answers: { a: 'x' },
    });
    expect(state.isComplete).toBe(true);
  });

  it('التقدّم يبقى ضمن [0,1]', () => {
    const questions = [makeQuestion({ key: 'a' }), makeQuestion({ key: 'b' })];
    for (const index of [-5, 0, 1, 2, 99]) {
      const state = computeState({
        questions,
        conditions: [],
        answers: {},
        currentStepIndex: index,
      });
      expect(state.progress).toBeGreaterThanOrEqual(0);
      expect(state.progress).toBeLessThanOrEqual(1);
    }
  });

  it('يصحّح رقم الخطوة الخارج عن النطاق', () => {
    const questions = [makeQuestion({ key: 'a' })];
    expect(
      computeState({ questions, conditions: [], answers: {}, currentStepIndex: -3 })
        .currentStepIndex,
    ).toBe(0);
    expect(
      computeState({ questions, conditions: [], answers: {}, currentStepIndex: 50 })
        .currentStepIndex,
    ).toBe(1); // = totalSteps ⇒ شاشة المراجعة
  });
});

describe('computeState — المنطق الشرطي', () => {
  it('السؤال ذو قاعدة SHOW مخفي افتراضياً', () => {
    const questions = [makeYesNo('has_debt', { order: 1 }), makeQuestion({ key: 'amount', order: 2 })];
    const conditions = [makeRule('amount', [clause('has_debt', 'IS_TRUE')])];

    const state = computeState({ questions, conditions, answers: {} });
    expect(keysOf(state.visible)).toEqual(['has_debt']);
  });

  it('يظهر عند تحقق الشرط', () => {
    const questions = [makeYesNo('has_debt', { order: 1 }), makeQuestion({ key: 'amount', order: 2 })];
    const conditions = [makeRule('amount', [clause('has_debt', 'IS_TRUE')])];

    const state = computeState({
      questions,
      conditions,
      answers: { has_debt: true },
    });
    expect(keysOf(state.visible)).toEqual(['has_debt', 'amount']);
  });

  it('HIDE يُخفي سؤالاً مرئياً افتراضياً', () => {
    const questions = [makeYesNo('is_employed', { order: 1 }), makeQuestion({ key: 'job', order: 2 })];
    const conditions = [
      makeRule('job', [clause('is_employed', 'IS_FALSE')], { action: 'HIDE' }),
    ];

    expect(
      keysOf(computeState({ questions, conditions, answers: { is_employed: true } }).visible),
    ).toEqual(['is_employed', 'job']);

    expect(
      keysOf(computeState({ questions, conditions, answers: { is_employed: false } }).visible),
    ).toEqual(['is_employed']);
  });

  it('السلسلة العميقة تُحلّ بالكامل (أ ← ب ← ج ← د)', () => {
    const questions = [
      makeYesNo('a', { order: 1 }),
      makeYesNo('b', { order: 2 }),
      makeYesNo('c', { order: 3 }),
      makeQuestion({ key: 'd', order: 4 }),
    ];
    const conditions = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('c', [clause('b', 'IS_TRUE')]),
      makeRule('d', [clause('c', 'IS_TRUE')]),
    ];

    expect(keysOf(computeState({ questions, conditions, answers: {} }).visible)).toEqual(['a']);

    expect(
      keysOf(computeState({ questions, conditions, answers: { a: true } }).visible),
    ).toEqual(['a', 'b']);

    expect(
      keysOf(
        computeState({ questions, conditions, answers: { a: true, b: true, c: true } })
          .visible,
      ),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('إخفاء الأب يُخفي كل الذرية حتى لو بقيت إجاباتها', () => {
    // هذه الحالة هي مصدر أخطر خلل ممكن: تسرّب حقائق ملغاة إلى المعروض.
    const questions = [
      makeYesNo('a', { order: 1 }),
      makeYesNo('b', { order: 2 }),
      makeQuestion({ key: 'c', order: 3 }),
    ];
    const conditions = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('c', [clause('b', 'IS_TRUE')]),
    ];

    const state = computeState({
      questions,
      conditions,
      answers: { a: false, b: true, c: 'قيمة قديمة' },
    });

    expect(keysOf(state.visible)).toEqual(['a']);
    expect(visibleAnswers(state, { a: false, b: true, c: 'قيمة قديمة' })).toEqual({
      a: false,
    });
  });

  it('REQUIRE يجعل السؤال مطلوباً ديناميكياً', () => {
    const questions = [
      makeYesNo('has_case', { order: 1 }),
      makeQuestion({ key: 'case_number', required: false, order: 2 }),
    ];
    const conditions = [
      makeRule('case_number', [clause('has_case', 'IS_TRUE')], {
        action: 'REQUIRE',
      }),
    ];

    const relaxed = computeState({ questions, conditions, answers: { has_case: false } });
    expect(relaxed.visible.find((q) => q.key === 'case_number')?.required).toBe(false);

    const strict = computeState({ questions, conditions, answers: { has_case: true } });
    expect(strict.visible.find((q) => q.key === 'case_number')?.required).toBe(true);
    expect(keysOf(strict.missingRequired)).toContain('case_number');
  });

  it('OPTIONAL يُخفّف سؤالاً مطلوباً', () => {
    const questions = [
      makeSelect('kind', ['فرد', 'منشأة'], { order: 1 }),
      makeQuestion({ key: 'national_id', required: true, order: 2 }),
    ];
    const conditions = [
      makeRule('national_id', [clause('kind', 'EQUALS', 'منشأة')], {
        action: 'OPTIONAL',
      }),
    ];

    const state = computeState({ questions, conditions, answers: { kind: 'منشأة' } });
    expect(state.visible.find((q) => q.key === 'national_id')?.required).toBe(false);
    expect(keysOf(state.missingRequired)).not.toContain('national_id');
  });

  it('HIDE يغلب SHOW عند تعارضهما', () => {
    const questions = [
      makeYesNo('a', { order: 1 }),
      makeQuestion({ key: 'x', order: 2 }),
    ];
    const conditions = [
      makeRule('x', [clause('a', 'IS_TRUE')], { action: 'SHOW', order: 0 }),
      makeRule('x', [clause('a', 'IS_TRUE')], { action: 'HIDE', order: 1 }),
    ];

    expect(
      keysOf(computeState({ questions, conditions, answers: { a: true } }).visible),
    ).toEqual(['a']);
  });

  it('السؤال المخفي لا يُحتسب في totalSteps', () => {
    const questions = [
      makeYesNo('a', { order: 1 }),
      makeQuestion({ key: 'b', order: 2 }),
      makeQuestion({ key: 'c', order: 3 }),
    ];
    const conditions = [
      makeRule('b', [clause('a', 'IS_TRUE')]),
      makeRule('c', [clause('a', 'IS_TRUE')]),
    ];

    expect(computeState({ questions, conditions, answers: {} }).totalSteps).toBe(1);
    expect(
      computeState({ questions, conditions, answers: { a: true } }).totalSteps,
    ).toBe(3);
  });
});

describe('سيناريو المديونية الكامل', () => {
  const { questions, conditions, subQuestions } = debtScenario();

  it('«لا» ⇒ لا تظهر أي أسئلة فرعية', () => {
    const state = computeState({
      questions,
      conditions,
      answers: { full_name: 'محمد', has_debt: false },
    });

    expect(keysOf(state.visible)).toEqual(['full_name', 'has_debt', 'city']);
    for (const key of subQuestions) {
      expect(keysOf(state.visible)).not.toContain(key);
    }
  });

  it('«نعم» ⇒ تظهر الأسئلة الخمسة', () => {
    const state = computeState({
      questions,
      conditions,
      answers: { full_name: 'محمد', has_debt: true },
    });

    for (const key of subQuestions) {
      expect(keysOf(state.visible)).toContain(key);
    }
    expect(state.totalSteps).toBe(8);
  });

  it('التبديل من نعم إلى لا يُخفي الفرع لكن الإجابات تبقى محفوظة', () => {
    const answers: AnswerMap = {
      full_name: 'محمد',
      has_debt: true,
      debt_amount: 50000,
      creditor_name: 'بنك',
    };

    const shown = computeState({ questions, conditions, answers });
    expect(keysOf(shown.visible)).toContain('debt_amount');

    const hidden = computeState({
      questions,
      conditions,
      answers: { ...answers, has_debt: false },
    });
    expect(keysOf(hidden.visible)).not.toContain('debt_amount');
    // الإجابة نفسها لم تُمسح — العودة إلى «نعم» تستعيدها.
    expect(answers.debt_amount).toBe(50000);

    const reshown = computeState({ questions, conditions, answers });
    expect(keysOf(reshown.visible)).toContain('debt_amount');
  });

  it('عدد الخطوات يتغيّر بصدق مع الإجابة', () => {
    const withoutDebt = computeState({
      questions,
      conditions,
      answers: { has_debt: false },
    });
    const withDebt = computeState({
      questions,
      conditions,
      answers: { has_debt: true },
    });

    expect(withoutDebt.totalSteps).toBe(3);
    expect(withDebt.totalSteps).toBe(8);
  });
});

describe('buildSteps', () => {
  it('سؤال واحد لكل خطوة افتراضياً', () => {
    const steps = buildSteps([
      makeQuestion({ key: 'a', order: 1 }),
      makeQuestion({ key: 'b', order: 2 }),
    ]);
    expect(steps).toHaveLength(2);
  });

  it('يضمّ سؤالين قصيرين بنفس groupKey في خطوة واحدة', () => {
    const steps = buildSteps([
      makeQuestion({ key: 'first_name', groupKey: 'name', order: 1 }),
      makeQuestion({ key: 'last_name', groupKey: 'name', order: 2 }),
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.questions).toHaveLength(2);
  });

  it('لا يضمّ أكثر من سؤالين', () => {
    const steps = buildSteps([
      makeQuestion({ key: 'a', groupKey: 'g', order: 1 }),
      makeQuestion({ key: 'b', groupKey: 'g', order: 2 }),
      makeQuestion({ key: 'c', groupKey: 'g', order: 3 }),
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0]?.questions).toHaveLength(2);
    expect(steps[1]?.questions).toHaveLength(1);
  });

  it('النص الطويل يبقى وحده حتى مع groupKey', () => {
    const steps = buildSteps([
      makeQuestion({ key: 'a', groupKey: 'g', order: 1 }),
      makeQuestion({ key: 'reason', type: 'TEXTAREA', groupKey: 'g', order: 2 }),
    ]);
    expect(steps).toHaveLength(2);
  });
});

describe('nextStepIndex', () => {
  it('يتخطى الخطوات المُجاب عنها', () => {
    const questions = [
      makeQuestion({ key: 'a', order: 1 }),
      makeQuestion({ key: 'b', order: 2 }),
      makeQuestion({ key: 'c', order: 3 }),
    ];
    const answers: AnswerMap = { a: 'x', b: 'y' };
    const state = computeState({
      questions,
      conditions: [],
      answers,
      currentStepIndex: 0,
    });

    expect(nextStepIndex(state, answers)).toBe(2);
  });

  it('تجاوز آخر خطوة يعني الوصول للمراجعة', () => {
    const questions = [makeQuestion({ key: 'a' })];
    const answers: AnswerMap = { a: 'x' };
    const state = computeState({
      questions,
      conditions: [],
      answers,
      currentStepIndex: 0,
    });

    expect(nextStepIndex(state, answers)).toBe(state.totalSteps);
  });
});
