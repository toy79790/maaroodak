import type {
  ConditionClause,
  ConditionRule,
  QuestionDef,
  QuestionTypeName,
} from '@/types/questions';

/** مولّدات بيانات للاختبارات — تُبقي الاختبارات مركّزة على ما تفحصه. */

let counter = 0;
const nextId = () => `id-${(counter += 1)}`;

export function makeQuestion(
  overrides: Partial<QuestionDef> & { key: string },
): QuestionDef {
  const type: QuestionTypeName = overrides.type ?? 'TEXT';

  return {
    id: overrides.id ?? nextId(),
    key: overrides.key,
    label: overrides.label ?? `سؤال ${overrides.key}`,
    description: overrides.description ?? null,
    type,
    required: overrides.required ?? true,
    placeholder: overrides.placeholder ?? null,
    helpText: overrides.helpText ?? null,
    groupKey: overrides.groupKey ?? null,
    order: overrides.order ?? 0,
    options: overrides.options ?? [],
    validation: overrides.validation ?? null,
    aiHint: overrides.aiHint ?? null,
    scopeSpecificity: overrides.scopeSpecificity ?? 0,
  };
}

export function makeYesNo(
  key: string,
  overrides: Partial<QuestionDef> = {},
): QuestionDef {
  return makeQuestion({ key, type: 'YES_NO', ...overrides });
}

export function makeSelect(
  key: string,
  values: readonly string[],
  overrides: Partial<QuestionDef> = {},
): QuestionDef {
  return makeQuestion({
    key,
    type: 'SELECT',
    options: values.map((value, index) => ({
      value,
      label: value,
      order: index,
    })),
    ...overrides,
  });
}

export function makeRule(
  targetQuestionKey: string,
  clauses: ConditionClause[],
  overrides: Partial<ConditionRule> = {},
): ConditionRule {
  return {
    id: overrides.id ?? nextId(),
    targetQuestionKey,
    action: overrides.action ?? 'SHOW',
    logic: overrides.logic ?? 'AND',
    clauses,
    order: overrides.order ?? 0,
  };
}

export function clause(
  sourceQuestionKey: string,
  operator: ConditionClause['operator'],
  value?: ConditionClause['value'],
): ConditionClause {
  return { sourceQuestionKey, operator, ...(value === undefined ? {} : { value }) };
}

/**
 * سيناريو المديونية الكامل من متطلبات المشروع:
 * «هل لديك مديونية؟» نعم ⇒ 5 أسئلة فرعية.
 */
export function debtScenario() {
  const questions: QuestionDef[] = [
    makeQuestion({ key: 'full_name', order: 1 }),
    makeYesNo('has_debt', { order: 2 }),
    makeQuestion({ key: 'debt_amount', type: 'NUMBER', order: 3 }),
    makeQuestion({ key: 'creditor_name', order: 4 }),
    makeQuestion({ key: 'debt_reason', type: 'TEXTAREA', order: 5 }),
    makeQuestion({ key: 'debt_duration', order: 6 }),
    makeYesNo('has_claim', { order: 7 }),
    makeQuestion({ key: 'city', order: 8 }),
  ];

  const subQuestions = [
    'debt_amount',
    'creditor_name',
    'debt_reason',
    'debt_duration',
    'has_claim',
  ];

  const conditions: ConditionRule[] = subQuestions.map((key) =>
    makeRule(key, [clause('has_debt', 'IS_TRUE')]),
  );

  return { questions, conditions, subQuestions };
}
