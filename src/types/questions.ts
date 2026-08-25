/**
 * أنواع محرك الأسئلة.
 *
 * مستقلة تماماً عن Prisma عمداً: المحرك دالة نقية تُختبر بمصفوفات عادية،
 * وطبقة البيانات هي التي تُحوّل سجلات القاعدة إلى هذه الأنواع.
 * (docs/ARCHITECTURE.md §5)
 */

export type QuestionTypeName =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'RADIO'
  | 'CHECKBOX'
  | 'YES_NO'
  | 'FILE';

export type ConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IS_TRUE'
  | 'IS_FALSE';

export type ConditionActionName = 'SHOW' | 'HIDE' | 'REQUIRE' | 'OPTIONAL';
export type ConditionLogicName = 'AND' | 'OR';

/** قيمة الإجابة — CHECKBOX يُنتج مصفوفة، YES_NO يُنتج boolean. */
export type AnswerValue = string | number | boolean | string[] | null;

export type AnswerMap = Record<string, AnswerValue>;

export interface QuestionOptionDef {
  value: string;
  label: string;
  order: number;
}

export interface QuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** نمط تعبير نمطي كنص — يُترجم عند بناء المخطط. */
  pattern?: string;
  patternMessage?: string;
  /** لتواريخ: 'past' | 'future' | 'any' */
  dateRange?: 'past' | 'future' | 'any';
}

export interface QuestionDef {
  id: string;
  /** المفتاح المستخدم في القالب والشروط. فريد ضمن المقابلة الواحدة. */
  key: string;
  label: string;
  description?: string | null;
  type: QuestionTypeName;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  /** أسئلة بنفس groupKey تُعرض في شاشة واحدة. */
  groupKey?: string | null;
  order: number;
  options: QuestionOptionDef[];
  validation?: QuestionValidation | null;
  /** تلميح للذكاء الاصطناعي عن كيفية توظيف الإجابة. */
  aiHint?: string | null;
  /** خصوصية النطاق — الأعلى يفوز عند تكرار المفتاح. انظر resolveScope. */
  scopeSpecificity: number;
}

export interface ConditionClause {
  sourceQuestionKey: string;
  operator: ConditionOperator;
  value?: AnswerValue;
}

export interface ConditionRule {
  id: string;
  targetQuestionKey: string;
  action: ConditionActionName;
  logic: ConditionLogicName;
  clauses: ConditionClause[];
  order: number;
}

// --- حالة المحرك ------------------------------------------------------------

export interface EngineStep {
  index: number;
  questions: QuestionDef[];
}

export interface EngineState {
  /** الأسئلة المرئية بعد تقييم الشروط، مرتّبة. */
  visible: QuestionDef[];
  steps: EngineStep[];
  currentStepIndex: number;
  totalSteps: number;
  /** 0..1 */
  progress: number;
  isComplete: boolean;
  /** المطلوبة المرئية غير المُجاب عنها. */
  missingRequired: QuestionDef[];
  answeredCount: number;
  canGoBack: boolean;
  canGoNext: boolean;
}

export interface EngineInput {
  questions: QuestionDef[];
  conditions: ConditionRule[];
  answers: AnswerMap;
  /** الخطوة المطلوب عرضها — تُصحَّح إن خرجت عن النطاق. */
  currentStepIndex?: number;
}
