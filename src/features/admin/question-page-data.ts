import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type {
  ConditionRule,
  QuestionFormValue,
  ScopeOption,
} from '@/features/admin/components/question-builder';

/**
 * تجهيز بيانات صفحة بنّاء الأسئلة.
 *
 * مفصولة عن الصفحة لأنها مشتركة بين «سؤال جديد» و«تعديل سؤال»، وتحويل
 * سجل القاعدة إلى نموذج الواجهة منطق حقيقي لا عرض.
 */

export const EMPTY_QUESTION: QuestionFormValue = {
  key: '',
  label: '',
  description: '',
  type: 'TEXT',
  required: true,
  placeholder: '',
  helpText: '',
  groupKey: '',
  order: 100,
  aiHint: '',
  departmentId: '',
  requestTypeId: '',
  isActive: true,
  options: [],
  conditions: [],
};

export interface QuestionPageData {
  departments: ScopeOption[];
  requestTypes: ScopeOption[];
  availableKeys: Array<{ key: string; label: string }>;
}

export async function loadQuestionPageData(): Promise<QuestionPageData> {
  const [departments, requestTypes, questions] = await Promise.all([
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.requestType.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.question.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { order: 'asc' },
      select: { key: true, label: true },
      distinct: ['key'],
    }),
  ]);

  return {
    departments,
    requestTypes,
    availableKeys: questions.map((question) => ({
      key: question.key,
      // نص مختصر — القائمة المنسدلة تضيق بالنصوص الطويلة.
      label:
        question.label.length > 45
          ? `${question.label.slice(0, 45)}…`
          : question.label,
    })),
  };
}

interface StoredClause {
  sourceQuestionKey?: unknown;
  operator?: unknown;
  value?: unknown;
}

/** تحويل سجل السؤال إلى نموذج الواجهة. */
export async function loadQuestionForEdit(
  id: string,
): Promise<QuestionFormValue | null> {
  const question = await prisma.question.findFirst({
    where: { id, deletedAt: null },
    select: {
      key: true,
      label: true,
      description: true,
      type: true,
      required: true,
      placeholder: true,
      helpText: true,
      groupKey: true,
      order: true,
      aiHint: true,
      isActive: true,
      departmentId: true,
      requestTypeId: true,
      options: { orderBy: { order: 'asc' }, select: { value: true, label: true } },
      conditions: {
        orderBy: { order: 'asc' },
        select: { action: true, logic: true, clauses: true },
      },
    },
  });

  if (!question) return null;

  const conditions: ConditionRule[] = question.conditions.map((condition) => {
    const rawClauses = Array.isArray(condition.clauses)
      ? (condition.clauses as StoredClause[])
      : [];

    return {
      action: condition.action,
      logic: condition.logic,
      clauses: rawClauses.map((clause) => ({
        sourceQuestionKey:
          typeof clause.sourceQuestionKey === 'string'
            ? clause.sourceQuestionKey
            : '',
        operator: typeof clause.operator === 'string' ? clause.operator : 'EQUALS',
        value:
          clause.value === null || clause.value === undefined
            ? ''
            : String(clause.value),
      })),
    };
  });

  return {
    key: question.key,
    label: question.label,
    description: question.description ?? '',
    type: question.type,
    required: question.required,
    placeholder: question.placeholder ?? '',
    helpText: question.helpText ?? '',
    groupKey: question.groupKey ?? '',
    order: question.order,
    aiHint: question.aiHint ?? '',
    departmentId: question.departmentId ?? '',
    requestTypeId: question.requestTypeId ?? '',
    isActive: question.isActive,
    options: question.options.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    conditions,
  };
}
