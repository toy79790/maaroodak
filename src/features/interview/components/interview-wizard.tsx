'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, AlertCircle, Sparkles, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QuestionInput } from '@/features/interview/components/question-input';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { AnswerMap, AnswerValue, EngineState } from '@/types/questions';

/**
 * معالج المقابلة — الشاشة الأهم في المنتج.
 *
 * قرارات تجربة الاستخدام:
 *  · سؤال (أو سؤالان مترابطان) في كل شاشة — لا نموذج ضخم.
 *  · التقدّم صادق: `totalSteps` يُعاد حسابه من الخادم بعد كل إجابة.
 *  · حفظ تلقائي عند كل انتقال — المستخدم لا يفقد شيئاً إن أغلق الصفحة.
 *  · زر «التالي» ثابت أسفل الشاشة على الجوال.
 *  · Enter ينتقل للسؤال التالي في الحقول القصيرة.
 */

export interface InterviewData {
  sessionId: string;
  department: { id: string; name: string; slug: string };
  requestType: { id: string; name: string; slug: string };
  state: EngineState;
  answers: AnswerMap;
}

interface ApiResult extends InterviewData {
  fieldErrors?: Record<string, string>;
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** الأرقام العربية-الهندية في عدّاد الخطوات — أدفأ بصرياً في سياق عربي. */
function toArabicNumeral(value: number): string {
  return String(value)
    .split('')
    .map((digit) => ARABIC_DIGITS[Number(digit)] ?? digit)
    .join('');
}

function ProgressHeader({
  state,
  departmentName,
  requestTypeName,
}: {
  state: EngineState;
  departmentName: string;
  requestTypeName: string;
}) {
  const isReview = state.currentStepIndex >= state.totalSteps;
  const displayStep = Math.min(state.currentStepIndex + 1, state.totalSteps);
  const percent = Math.round(
    (isReview ? 1 : state.currentStepIndex / Math.max(state.totalSteps, 1)) * 100,
  );

  return (
    <div className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{departmentName}</Badge>
        <Badge tone="neutral">{requestTypeName}</Badge>
      </div>

      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">
          {isReview
            ? 'مراجعة المعلومات'
            : `السؤال ${toArabicNumeral(displayStep)} من ${toArabicNumeral(state.totalSteps)}`}
        </span>
        <span className="tabular text-muted-foreground">{percent}%</span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="تقدّم المقابلة"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** شاشة مراجعة كل الإجابات قبل التوليد. */
function ReviewStep({
  data,
  onEdit,
  onGenerate,
  generating,
}: {
  data: InterviewData;
  onEdit: (stepIndex: number) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const stepByKey = new Map<string, number>();
  for (const step of data.state.steps) {
    for (const question of step.questions) {
      stepByKey.set(question.key, step.index);
    }
  }

  const answered = data.state.visible.filter((question) => {
    const value = data.answers[question.key];
    return value !== undefined && value !== null && value !== '';
  });

  const formatValue = (question: (typeof answered)[number]): string => {
    const value = data.answers[question.key];

    if (typeof value === 'boolean') return value ? 'نعم' : 'لا';

    if (Array.isArray(value)) {
      return value
        .map(
          (item) =>
            question.options.find((option) => option.value === item)?.label ?? item,
        )
        .join('، ');
    }

    const option = question.options.find((item) => item.value === value);
    return option?.label ?? String(value ?? '');
  };

  return (
    <div>
      <h1 className="text-xl font-bold">راجع معلوماتك</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        سيُبنى المعروض من هذه المعلومات وحدها. تأكد من صحة الأرقام والأسماء
        والتواريخ قبل المتابعة.
      </p>

      {data.state.missingRequired.length > 0 ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-field)] border border-warning/40 bg-warning-subtle px-4 py-3"
        >
          <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-warning">
              يلزم إكمال {toArabicNumeral(data.state.missingRequired.length)} من
              الأسئلة المطلوبة
            </p>
            <ul className="mt-1.5 space-y-1">
              {data.state.missingRequired.map((question) => (
                <li key={question.key}>
                  <button
                    type="button"
                    onClick={() => onEdit(stepByKey.get(question.key) ?? 0)}
                    className="text-warning underline underline-offset-2 hover:opacity-80"
                  >
                    {question.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <dl className="mt-6 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
        {answered.map((question) => (
          <div
            key={question.key}
            className="flex items-start justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{question.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                {formatValue(question)}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(stepByKey.get(question.key) ?? 0)}
              aria-label={`تعديل: ${question.label}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <Pencil className="size-3.5" aria-hidden />
              تعديل
            </button>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
        <Button
          size="lg"
          onClick={onGenerate}
          loading={generating}
          disabled={data.state.missingRequired.length > 0}
          className="sm:flex-1"
        >
          <Sparkles className="size-5" />
          أنشئ المعروض
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => onEdit(Math.max(data.state.totalSteps - 1, 0))}
        >
          <ArrowRight className="size-5" />
          رجوع
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-subtle-foreground">
        سيُخصم رصيد واحد عند إنشاء المعروض.
      </p>
    </div>
  );
}

export function InterviewWizard({ initial }: { initial: InterviewData }) {
  const router = useRouter();
  const [data, setData] = React.useState<InterviewData>(initial);
  const [draft, setDraft] = React.useState<Record<string, AnswerValue>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const { state } = data;
  const isReview = state.currentStepIndex >= state.totalSteps;
  const currentStep = state.steps[state.currentStepIndex];

  // مسح المسودة المحلية عند تغيّر الخطوة — الخادم هو مصدر الحقيقة.
  React.useEffect(() => {
    setDraft({});
    setFieldErrors({});
  }, [state.currentStepIndex]);

  const valueFor = (key: string): AnswerValue =>
    key in draft ? (draft[key] ?? null) : (data.answers[key] ?? null);

  function applyResult(result: ApiResult) {
    setData({
      sessionId: result.sessionId,
      department: result.department,
      requestType: result.requestType,
      state: result.state,
      answers: result.answers,
    });
    setFieldErrors(result.fieldErrors ?? {});
  }

  async function save(advance: boolean) {
    if (!currentStep) return;

    const payload: Record<string, unknown> = {};
    for (const question of currentStep.questions) {
      payload[question.key] = valueFor(question.key);
    }

    setPending(true);
    try {
      const response = await api.patch<ApiResult>(
        `/api/interview/${data.sessionId}/answer`,
        { answers: payload, advance },
      );
      applyResult(response.data);
      if (Object.keys(response.data.fieldErrors ?? {}).length > 0) {
        setDraft({});
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'تعذّر حفظ الإجابة.',
      );
    } finally {
      setPending(false);
    }
  }

  async function goBack() {
    setPending(true);
    try {
      const response = await api.post<ApiResult>(
        `/api/interview/${data.sessionId}/back`,
      );
      applyResult(response.data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الرجوع.');
    } finally {
      setPending(false);
    }
  }

  async function goToStep(step: number) {
    setPending(true);
    try {
      const response = await api.post<ApiResult>(
        `/api/interview/${data.sessionId}/step`,
        { step },
      );
      applyResult(response.data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الانتقال.');
    } finally {
      setPending(false);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const response = await api.post<{ letter: { id: string } }>(
        '/api/letters/generate',
        { sessionId: data.sessionId },
      );
      router.push(`/letters/${response.data.letter.id}`);
    } catch (error) {
      setGenerating(false);
      if (error instanceof ApiError) {
        if (error.code === 'INSUFFICIENT_CREDITS') {
          toast.error(error.message, {
            action: { label: 'الخطط', onClick: () => router.push('/credits') },
          });
          return;
        }
        toast.error(error.message);
        return;
      }
      toast.error('تعذّر إنشاء المعروض.');
    }
  }

  // Enter ينتقل للتالي في الحقول القصيرة — تسريع ملموس على لوحة المفاتيح.
  function onKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;
    event.preventDefault();
    if (!pending) void save(true);
  }

  if (isReview) {
    return (
      <ReviewStep
        data={data}
        onEdit={(step) => void goToStep(step)}
        onGenerate={() => void generate()}
        generating={generating}
      />
    );
  }

  if (!currentStep) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong p-10 text-center">
        <p className="text-muted-foreground">لا توجد أسئلة متاحة لهذا الاختيار.</p>
        <Button variant="secondary" className="mt-5" asChild>
          <Link href="/new">اختر جهة أخرى</Link>
        </Button>
      </div>
    );
  }

  const canAdvance = currentStep.questions.every((question) => {
    if (!question.required) return true;
    const value = valueFor(question.key);
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });

  return (
    <div>
      <ProgressHeader
        state={state}
        departmentName={data.department.name}
        requestTypeName={data.requestType.name}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
        onKeyDown={onKeyDown}
        className="animate-fade-up"
        key={state.currentStepIndex}
      >
        <div className="space-y-8">
          {currentStep.questions.map((question, index) => {
            const error = fieldErrors[question.key];
            return (
              <div key={question.key}>
                <label
                  htmlFor={`q-${question.key}`}
                  className="block text-lg font-semibold leading-snug"
                >
                  {question.label}
                  {question.required ? null : (
                    <span className="ms-2 text-xs font-normal text-muted-foreground">
                      (اختياري)
                    </span>
                  )}
                </label>

                {question.description ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {question.description}
                  </p>
                ) : null}

                <div className="mt-4">
                  <QuestionInput
                    question={question}
                    value={valueFor(question.key)}
                    error={error}
                    autoFocus={index === 0}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, [question.key]: value }))
                    }
                  />
                </div>

                {question.helpText ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {question.helpText}
                  </p>
                ) : null}

                {error ? (
                  <p
                    id={`q-${question.key}-error`}
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* شريط الإجراءات — ثابت أسفل الشاشة على الجوال */}
        <div
          className={cn(
            'mt-10 flex gap-3',
            'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:mt-0',
            'max-lg:border-t max-lg:border-border max-lg:bg-background max-lg:p-4',
          )}
        >
          {state.canGoBack ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => void goBack()}
              disabled={pending}
            >
              <ArrowRight className="size-5" />
              <span className="max-sm:sr-only">رجوع</span>
            </Button>
          ) : null}

          <Button type="submit" size="lg" loading={pending} disabled={!canAdvance} className="flex-1">
            {state.currentStepIndex === state.totalSteps - 1 ? 'مراجعة' : 'التالي'}
            <ArrowLeft className="size-5" />
          </Button>
        </div>

        {/* مساحة تعويض الشريط الثابت على الجوال */}
        <div className="h-24 lg:hidden" aria-hidden />
      </form>
    </div>
  );
}
