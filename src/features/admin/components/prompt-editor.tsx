'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Play, ShieldCheck, Loader2, Coins, Timer } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormError, FormField } from '@/components/shared/form-field';
import {
  FormActions,
  FormSection,
  Toggle,
  adminSelectClass,
  useFormErrors,
} from '@/features/admin/components/admin-form';
import { api, ApiError } from '@/lib/api/client';

/**
 * محرر الموجّهات مع لوحة تجربة حيّة.
 *
 * التجربة هنا هي أهم أداة لجودة المنتج: تسمح بضبط الصياغة العربية على
 * بيانات وهمية بلا نشر وبلا استهلاك رصيد أي مستخدم، وتعرض التكلفة الفعلية
 * لكل تجربة حتى يبقى ضبط الجودة واعياً بتكلفته.
 */

export interface PromptFormValue {
  key: string;
  name: string;
  description: string;
  type: string;
  content: string;
  model: string;
  maxTokens: number | null;
  departmentId: string;
  requestTypeId: string;
  isActive: boolean;
}

export const EMPTY_PROMPT: PromptFormValue = {
  key: '',
  name: '',
  description: '',
  type: 'GENERATION',
  content: '',
  model: '',
  maxTokens: null,
  departmentId: '',
  requestTypeId: '',
  isActive: true,
};

export const PROMPT_TYPE_LABELS: Record<string, string> = {
  SYSTEM: 'قواعد الأسلوب (L2)',
  GENERATION: 'توليد المعروض',
  FOLLOW_UP: 'أسئلة المتابعة',
  QUALITY_CHECK: 'فحص الجودة',
  TOOL_IMPROVE: 'أداة: تحسين الصياغة',
  TOOL_FORMALIZE: 'أداة: صياغة رسمية',
  TOOL_SHORTEN: 'أداة: اختصار',
  TOOL_EXPAND: 'أداة: توسيع',
  TOOL_CLARIFY: 'أداة: توضيح الطلب',
  TOOL_REWRITE: 'أداة: إعادة كتابة',
  TOOL_TITLE: 'أداة: اقتراح عنوان',
  TOOL_INTRO: 'أداة: تحسين المقدمة',
  TOOL_CONCLUSION: 'أداة: تحسين الخاتمة',
  TOOL_PROOFREAD: 'أداة: تدقيق لغوي',
};

const MODELS = [
  { value: '', label: 'الافتراضي من الإعدادات' },
  { value: 'claude-opus-5', label: 'Claude Opus 5 — الأدق' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — متوازن' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — الأسرع' },
];

interface TestResult {
  output: string;
  stopReason: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export function PromptEditor({
  initial,
  promptId,
  departments,
  requestTypes,
  aiEnabled,
}: {
  initial: PromptFormValue;
  promptId?: string;
  departments: ReadonlyArray<{ id: string; name: string }>;
  requestTypes: ReadonlyArray<{ id: string; name: string }>;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [result, setResult] = React.useState<TestResult | null>(null);
  const [sampleFacts, setSampleFacts] = React.useState('');
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  const set = <K extends keyof PromptFormValue>(key: K, next: PromptFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const isCoreType = value.type === 'SYSTEM';

  async function runTest() {
    setTesting(true);
    setResult(null);

    try {
      const response = await api.put<TestResult>('/api/admin/prompts', {
        content: value.content,
        sampleFacts,
        ...(value.model ? { model: value.model } : {}),
      });
      setResult(response.data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'تعذّر تشغيل التجربة.',
      );
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    reset();
    setPending(true);

    const payload = {
      ...value,
      departmentId: value.departmentId || null,
      requestTypeId: value.requestTypeId || null,
      maxTokens: value.maxTokens ? Number(value.maxTokens) : null,
    };

    try {
      if (promptId) {
        await api.patch(`/api/admin/prompts/${promptId}`, payload);
      } else {
        await api.post('/api/admin/prompts', payload);
      }

      toast.success('تم حفظ الموجّه');
      router.push('/admin/prompts');
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormError message={formError} />

      <div className="flex items-start gap-2.5 rounded-[var(--radius-field)] border border-info/30 bg-info-subtle px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden />
        <p className="text-sm leading-relaxed text-info">
          قواعد منع الاختراع (الطبقة L1) مثبّتة في الشيفرة ولا يمكن تعديلها من هنا.
          ما تكتبه أدناه يُضاف فوقها ولا يُلغيها.
        </p>
      </div>

      <FormSection title="بيانات الموجّه">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="p-name" label="الاسم" error={fieldErrors.name} required>
            {(props) => (
              <Input
                {...props}
                value={value.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="سياق وزارة الصحة"
              />
            )}
          </FormField>

          <FormField id="p-key" label="المفتاح" error={fieldErrors.key} required>
            {(props) => (
              <Input
                {...props}
                value={value.key}
                onChange={(event) => set('key', event.target.value)}
                placeholder="dept.ministry-health"
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="p-type" label="النوع" error={fieldErrors.type} required>
            {(props) => (
              <select
                {...props}
                value={value.type}
                onChange={(event) => set('type', event.target.value)}
                className={adminSelectClass}
              >
                {Object.entries(PROMPT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            id="p-model"
            label="النموذج"
            description="اتركه افتراضياً ما لم تكن لديك حاجة خاصة."
          >
            {(props) => (
              <select
                {...props}
                value={value.model}
                onChange={(event) => set('model', event.target.value)}
                className={adminSelectClass}
              >
                {MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            id="p-description"
            label="الوصف"
            error={fieldErrors.description}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={value.description}
                onChange={(event) => set('description', event.target.value)}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      {!isCoreType ? (
        <FormSection
          title="نطاق الموجّه"
          description="موجّه الجهة وموجّه نوع الطلب يتراكمان معاً في التوليد — الأول يحدّد النبرة والثاني يحدّد زاوية الإقناع."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="p-dept" label="الجهة">
              {(props) => (
                <select
                  {...props}
                  value={value.departmentId}
                  onChange={(event) => set('departmentId', event.target.value)}
                  className={adminSelectClass}
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

            <FormField id="p-rtype" label="نوع الطلب">
              {(props) => (
                <select
                  {...props}
                  value={value.requestTypeId}
                  onChange={(event) => set('requestTypeId', event.target.value)}
                  className={adminSelectClass}
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
        </FormSection>
      ) : null}

      <FormSection title="محتوى الموجّه">
        <FormField id="p-content" label="النص" error={fieldErrors.content} required>
          {(props) => (
            <Textarea
              {...props}
              rows={16}
              value={value.content}
              onChange={(event) => set('content', event.target.value)}
              placeholder="اكتب التعليمات الموجّهة للنموذج…"
              className="leading-7"
            />
          )}
        </FormField>

        <div className="mt-4">
          <Toggle
            checked={value.isActive}
            onChange={(next) => set('isActive', next)}
            label="الموجّه مُفعّل"
            description="الموجّه المعطّل يُتجاهل ويُستخدم الأعمّ منه."
          />
        </div>
      </FormSection>

      {/* --- لوحة التجربة --- */}
      <FormSection
        title="تجربة الموجّه"
        description="يُشغَّل على بيانات وهمية بلا حفظ وبلا خصم رصيد من أي مستخدم. التكلفة معروضة أدناه."
      >
        <FormField
          id="p-facts"
          label="حقائق التجربة"
          description="اتركها فارغة لاستخدام حالة مديونية جاهزة."
        >
          {(props) => (
            <Textarea
              {...props}
              rows={5}
              value={sampleFacts}
              onChange={(event) => setSampleFacts(event.target.value)}
              placeholder={'- الاسم الكامل: محمد بن عبدالله السالم\n- المدينة: الرياض\n- قيمة المديونية: 85000'}
            />
          )}
        </FormField>

        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => void runTest()}
          loading={testing}
          disabled={!aiEnabled || value.content.trim().length < 10}
        >
          <Play className="size-4" />
          شغّل التجربة
        </Button>

        {!aiEnabled ? (
          <p className="mt-2 text-xs text-muted-foreground">
            التجربة تتطلب تهيئة ANTHROPIC_API_KEY على الخادم.
          </p>
        ) : null}

        {testing ? (
          <div className="mt-5 flex items-center justify-center rounded-[var(--radius-field)] border border-border bg-surface-muted/40 py-14">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <span className="sr-only">جارٍ التوليد…</span>
          </div>
        ) : null}

        {result ? (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{result.model}</Badge>
              <Badge tone="neutral" className="tabular">
                <Coins className="size-3" aria-hidden />${result.costUsd.toFixed(5)}
              </Badge>
              <Badge tone="neutral" className="tabular">
                <Timer className="size-3" aria-hidden />
                {(result.latencyMs / 1000).toFixed(1)}ث
              </Badge>
              <Badge tone="neutral" className="tabular">
                {result.inputTokens} ← {result.outputTokens} رمز
              </Badge>
              {result.stopReason === 'refusal' ? (
                <Badge tone="danger">رفض النموذج</Badge>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-white p-6 sm:p-10">
              <pre className="whitespace-pre-wrap text-right text-[0.95rem] leading-8 text-[#111] [font-family:var(--font-letter)]">
                {result.output || '— لا مخرَج —'}
              </pre>
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormActions
        onSave={() => void save()}
        pending={pending}
        saveLabel={promptId ? 'حفظ التعديلات' : 'إنشاء الموجّه'}
        cancelHref="/admin/prompts"
      />
    </div>
  );
}
