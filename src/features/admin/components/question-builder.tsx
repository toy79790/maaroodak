'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, GitBranch, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FormError, FormField } from '@/components/shared/form-field';
import { api, ApiError } from '@/lib/api/client';
import {
  CONDITION_OPERATORS,
  QUESTION_TYPES,
  VALUELESS_OPERATORS,
} from '@/features/admin/schema';
import { QUESTION_TYPE_LABEL } from '@/features/letters/labels';
import { cn } from '@/lib/utils/cn';

/**
 * بنّاء الأسئلة المرئي — متطلب المشروع §27
 *
 * يسمح ببناء سؤال كامل بخياراته وقواعده الشرطية بلا كتابة كود ولا نشر.
 * كشف الدورات يجري على الخادم عند الحفظ (features/admin/service.ts).
 */

const OPERATOR_LABELS: Record<string, string> = {
  EQUALS: 'يساوي',
  NOT_EQUALS: 'لا يساوي',
  IN: 'ضمن',
  NOT_IN: 'ليس ضمن',
  CONTAINS: 'يحتوي',
  NOT_CONTAINS: 'لا يحتوي',
  GT: 'أكبر من',
  GTE: 'أكبر أو يساوي',
  LT: 'أصغر من',
  LTE: 'أصغر أو يساوي',
  IS_EMPTY: 'فارغ',
  IS_NOT_EMPTY: 'غير فارغ',
  IS_TRUE: 'نعم',
  IS_FALSE: 'لا',
};

const ACTION_LABELS = {
  SHOW: 'أظهر هذا السؤال',
  HIDE: 'أخفِ هذا السؤال',
  REQUIRE: 'اجعله مطلوباً',
  OPTIONAL: 'اجعله اختيارياً',
} as const;

export interface QuestionOption {
  value: string;
  label: string;
}

export interface ConditionClause {
  sourceQuestionKey: string;
  operator: string;
  value?: string | null;
}

export interface ConditionRule {
  action: keyof typeof ACTION_LABELS;
  logic: 'AND' | 'OR';
  clauses: ConditionClause[];
}

export interface QuestionFormValue {
  key: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  placeholder: string;
  helpText: string;
  groupKey: string;
  order: number;
  aiHint: string;
  departmentId: string;
  requestTypeId: string;
  isActive: boolean;
  options: QuestionOption[];
  conditions: ConditionRule[];
}

export interface ScopeOption {
  id: string;
  name: string;
}

const NEEDS_OPTIONS = new Set(['SELECT', 'RADIO', 'CHECKBOX']);

const selectClass =
  'w-full rounded-[var(--radius-field)] border border-border-strong bg-surface px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export function QuestionBuilder({
  initial,
  questionId,
  departments,
  requestTypes,
  availableKeys,
}: {
  initial: QuestionFormValue;
  questionId?: string;
  departments: readonly ScopeOption[];
  requestTypes: readonly ScopeOption[];
  /** مفاتيح الأسئلة المتاحة كمصادر للشروط. */
  availableKeys: ReadonlyArray<{ key: string; label: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<QuestionFormValue>(initial);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const set = <K extends keyof QuestionFormValue>(
    key: K,
    next: QuestionFormValue[K],
  ) => setValue((current) => ({ ...current, [key]: next }));

  const needsOptions = NEEDS_OPTIONS.has(value.type);

  async function save() {
    setFormError(null);
    setFieldErrors({});
    setPending(true);

    const payload = {
      ...value,
      departmentId: value.departmentId || null,
      requestTypeId: value.requestTypeId || null,
      order: Number(value.order) || 0,
      options: needsOptions ? value.options : [],
      conditions: value.conditions.map((rule) => ({
        ...rule,
        clauses: rule.clauses.map((clause) => ({
          ...clause,
          value: VALUELESS_OPERATORS.has(clause.operator)
            ? null
            : (clause.value ?? ''),
        })),
      })),
    };

    try {
      if (questionId) {
        await api.patch(`/api/admin/questions/${questionId}`, payload);
      } else {
        await api.post('/api/admin/questions', payload);
      }

      toast.success('تم حفظ السؤال');
      router.push('/admin/questions');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError('تعذّر الحفظ.');
      }
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormError message={formError} />

      {/* --- الأساسيات --- */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">بيانات السؤال</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="q-label"
            label="نص السؤال"
            description="كما سيراه المستخدم."
            error={fieldErrors.label}
            required
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={value.label}
                onChange={(event) => set('label', event.target.value)}
                placeholder="هل لديك مديونية قائمة؟"
              />
            )}
          </FormField>

          <FormField
            id="q-key"
            label="المفتاح"
            description="يُستخدم في القوالب والشروط. لا يُغيَّر بعد الاستخدام."
            error={fieldErrors.key}
            required
          >
            {(props) => (
              <Input
                {...props}
                value={value.key}
                onChange={(event) => set('key', event.target.value)}
                placeholder="has_debt"
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="q-type" label="نوع السؤال" error={fieldErrors.type} required>
            {(props) => (
              <select
                {...props}
                value={value.type}
                onChange={(event) => set('type', event.target.value)}
                className={selectClass}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABEL[type] ?? type}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            id="q-description"
            label="وصف توضيحي"
            error={fieldErrors.description}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={value.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="إجابتك تحدّد الأسئلة التالية."
              />
            )}
          </FormField>

          <FormField id="q-placeholder" label="نص إرشادي داخل الحقل">
            {(props) => (
              <Input
                {...props}
                value={value.placeholder}
                onChange={(event) => set('placeholder', event.target.value)}
              />
            )}
          </FormField>

          <FormField id="q-group" label="مفتاح التجميع" description="أسئلة بنفس المفتاح تُعرض في شاشة واحدة.">
            {(props) => (
              <Input
                {...props}
                value={value.groupKey}
                onChange={(event) => set('groupKey', event.target.value)}
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="q-order" label="الترتيب" error={fieldErrors.order}>
            {(props) => (
              <Input
                {...props}
                type="number"
                value={String(value.order)}
                onChange={(event) => set('order', Number(event.target.value))}
              />
            )}
          </FormField>

          <div className="flex items-end gap-5">
            {(
              [
                { key: 'required', label: 'مطلوب' },
                { key: 'isActive', label: 'مُفعّل' },
              ] as const
            ).map((toggle) => (
              <label key={toggle.key} className="flex items-center gap-2 pb-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={value[toggle.key]}
                  onChange={(event) => set(toggle.key, event.target.checked)}
                  className="size-4 rounded border-border-strong"
                />
                {toggle.label}
              </label>
            ))}
          </div>

          <FormField
            id="q-ai-hint"
            label="تلميح للذكاء الاصطناعي"
            description="كيف يوظّف النموذج هذه الإجابة في الصياغة."
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={value.aiHint}
                onChange={(event) => set('aiHint', event.target.value)}
                placeholder="يُذكر المبلغ رقماً كما هو. لا يُقرَّب ولا يُعدَّل."
              />
            )}
          </FormField>
        </div>
      </Card>

      {/* --- النطاق --- */}
      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold">نطاق السؤال</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          اتركهما فارغين ليظهر السؤال في كل المعاريض. الأخص يتقدّم على الأعم عند
          تكرار المفتاح.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="q-dept" label="الجهة">
            {(props) => (
              <select
                {...props}
                value={value.departmentId}
                onChange={(event) => set('departmentId', event.target.value)}
                className={selectClass}
              >
                <option value="">كل الجهات</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField id="q-type-scope" label="نوع الطلب">
            {(props) => (
              <select
                {...props}
                value={value.requestTypeId}
                onChange={(event) => set('requestTypeId', event.target.value)}
                className={selectClass}
              >
                <option value="">كل الأنواع</option>
                {requestTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
      </Card>

      {/* --- الخيارات --- */}
      {needsOptions ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">الخيارات</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                set('options', [...value.options, { value: '', label: '' }])
              }
            >
              <Plus className="size-4" />
              إضافة خيار
            </Button>
          </div>

          {fieldErrors.options ? (
            <p role="alert" className="mb-3 flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle className="size-3.5" aria-hidden />
              {fieldErrors.options}
            </p>
          ) : null}

          {value.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هذا النوع يتطلب خيارين على الأقل.
            </p>
          ) : (
            <ul className="space-y-2">
              {value.options.map((option, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    value={option.value}
                    onChange={(event) => {
                      const next = [...value.options];
                      next[index] = { ...option, value: event.target.value };
                      set('options', next);
                    }}
                    placeholder="القيمة (إنجليزية)"
                    dir="ltr"
                    className="w-44 text-start"
                    aria-label={`قيمة الخيار ${index + 1}`}
                  />
                  <Input
                    value={option.label}
                    onChange={(event) => {
                      const next = [...value.options];
                      next[index] = { ...option, label: event.target.value };
                      set('options', next);
                    }}
                    placeholder="النص المعروض"
                    className="flex-1"
                    aria-label={`نص الخيار ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'options',
                        value.options.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`حذف الخيار ${index + 1}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* --- الشروط --- */}
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4.5 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">القواعد الشرطية</h2>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              set('conditions', [
                ...value.conditions,
                {
                  action: 'SHOW',
                  logic: 'AND',
                  clauses: [
                    {
                      sourceQuestionKey: availableKeys[0]?.key ?? '',
                      operator: 'IS_TRUE',
                      value: '',
                    },
                  ],
                },
              ])
            }
          >
            <Plus className="size-4" />
            إضافة قاعدة
          </Button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          بلا قواعد، يظهر السؤال دائماً. قاعدة «أظهر» تجعله مخفياً حتى تتحقق.
        </p>

        {fieldErrors.conditions ? (
          <p role="alert" className="mb-3 flex items-start gap-1.5 text-xs text-danger">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {fieldErrors.conditions}
          </p>
        ) : null}

        {value.conditions.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد قواعد.</p>
        ) : (
          <ul className="space-y-4">
            {value.conditions.map((rule, ruleIndex) => (
              <li
                key={ruleIndex}
                className="rounded-[var(--radius-field)] border border-border bg-surface-muted/40 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select
                    value={rule.action}
                    onChange={(event) => {
                      const next = [...value.conditions];
                      next[ruleIndex] = {
                        ...rule,
                        action: event.target.value as ConditionRule['action'],
                      };
                      set('conditions', next);
                    }}
                    aria-label="الإجراء"
                    className={cn(selectClass, 'w-auto py-1.5 text-xs')}
                  >
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <span className="text-xs text-muted-foreground">عندما</span>

                  {rule.clauses.length > 1 ? (
                    <select
                      value={rule.logic}
                      onChange={(event) => {
                        const next = [...value.conditions];
                        next[ruleIndex] = {
                          ...rule,
                          logic: event.target.value as 'AND' | 'OR',
                        };
                        set('conditions', next);
                      }}
                      aria-label="منطق الربط"
                      className={cn(selectClass, 'w-auto py-1.5 text-xs')}
                    >
                      <option value="AND">كل الشروط</option>
                      <option value="OR">أي شرط</option>
                    </select>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'conditions',
                        value.conditions.filter((_, i) => i !== ruleIndex),
                      )
                    }
                    aria-label={`حذف القاعدة ${ruleIndex + 1}`}
                    className="ms-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <ul className="space-y-2">
                  {rule.clauses.map((clause, clauseIndex) => {
                    const needsValue = !VALUELESS_OPERATORS.has(clause.operator);

                    const updateClause = (patch: Partial<ConditionClause>) => {
                      const next = [...value.conditions];
                      const clauses = [...rule.clauses];
                      clauses[clauseIndex] = { ...clause, ...patch };
                      next[ruleIndex] = { ...rule, clauses };
                      set('conditions', next);
                    };

                    return (
                      <li key={clauseIndex} className="flex flex-wrap items-center gap-2">
                        <select
                          value={clause.sourceQuestionKey}
                          onChange={(event) =>
                            updateClause({ sourceQuestionKey: event.target.value })
                          }
                          aria-label="السؤال المصدر"
                          className={cn(selectClass, 'w-auto min-w-44 py-1.5 text-xs')}
                        >
                          {availableKeys.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label} ({item.key})
                            </option>
                          ))}
                        </select>

                        <select
                          value={clause.operator}
                          onChange={(event) =>
                            updateClause({ operator: event.target.value })
                          }
                          aria-label="العامل"
                          className={cn(selectClass, 'w-auto py-1.5 text-xs')}
                        >
                          {CONDITION_OPERATORS.map((operator) => (
                            <option key={operator} value={operator}>
                              {OPERATOR_LABELS[operator] ?? operator}
                            </option>
                          ))}
                        </select>

                        {needsValue ? (
                          <Input
                            value={clause.value ?? ''}
                            onChange={(event) =>
                              updateClause({ value: event.target.value })
                            }
                            placeholder="القيمة"
                            aria-label="القيمة"
                            className="w-40 py-1.5 text-xs"
                          />
                        ) : null}

                        {rule.clauses.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...value.conditions];
                              next[ruleIndex] = {
                                ...rule,
                                clauses: rule.clauses.filter(
                                  (_, i) => i !== clauseIndex,
                                ),
                              };
                              set('conditions', next);
                            }}
                            aria-label="حذف الشرط"
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    const next = [...value.conditions];
                    next[ruleIndex] = {
                      ...rule,
                      clauses: [
                        ...rule.clauses,
                        {
                          sourceQuestionKey: availableKeys[0]?.key ?? '',
                          operator: 'IS_TRUE',
                          value: '',
                        },
                      ],
                    };
                    set('conditions', next);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="size-3.5" aria-hidden />
                  إضافة شرط
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --- المعاينة والحفظ --- */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} loading={pending} size="lg">
          <Save className="size-4.5" />
          {questionId ? 'حفظ التعديلات' : 'إنشاء السؤال'}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.push('/admin/questions')}
        >
          إلغاء
        </Button>

        <div className="ms-auto flex flex-wrap gap-2">
          <Badge tone="neutral">{QUESTION_TYPE_LABEL[value.type] ?? value.type}</Badge>
          {value.required ? <Badge tone="warning">مطلوب</Badge> : null}
          {value.conditions.length > 0 ? (
            <Badge tone="brand">{value.conditions.length} قاعدة</Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}
