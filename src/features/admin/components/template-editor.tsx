'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Code2, AlertTriangle, Copy, Loader2 } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
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
import { cn } from '@/lib/utils/cn';

/**
 * محرر القوالب مع معاينة حيّة.
 *
 * المعاينة تشغّل محرك القوالب نفسه الذي يعمل في الإنتاج على بيانات وهمية،
 * فما يراه المسؤول هنا هو ما سيراه المستخدم بالضبط — بما في ذلك المتغيرات
 * الناقصة التي ستتحوّل إلى علامات [أدخل …].
 */

export interface TemplateFormValue {
  slug: string;
  name: string;
  description: string;
  body: string;
  departmentId: string;
  requestTypeId: string;
  isDefault: boolean;
  isActive: boolean;
}

export const EMPTY_TEMPLATE: TemplateFormValue = {
  slug: '',
  name: '',
  description: '',
  body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

وتفضلوا بقبول خالص الشكر والتقدير.

مقدّمه لكم / {{full_name}}
{{#if national_id}}رقم الهوية: {{national_id}}{{/if}}
{{#if phone}}رقم الجوال: {{phone}}{{/if}}
{{#if city}}المدينة: {{city}}{{/if}}
التاريخ: {{today}}

التوقيع: ........................`,
  departmentId: '',
  requestTypeId: '',
  isDefault: false,
  isActive: true,
};

/** المتغيرات المتاحة — تُدرَج بالنقر بدل حفظها. */
const VARIABLE_GROUPS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ name: string; hint: string }>;
}> = [
  {
    label: 'الذكاء الاصطناعي',
    items: [{ name: 'ai_body', hint: 'موضع المحتوى المُولَّد — إلزامي' }],
  },
  {
    label: 'الجهة والطلب',
    items: [
      { name: 'department_addressee', hint: 'سطر المخاطبة' },
      { name: 'department_name', hint: 'اسم الجهة' },
      { name: 'department_honorific', hint: 'اللقب' },
      { name: 'request_type_name', hint: 'نوع الطلب' },
      { name: 'subject', hint: 'موضوع المعروض' },
    ],
  },
  {
    label: 'مقدّم الطلب',
    items: [
      { name: 'full_name', hint: 'الاسم الكامل' },
      { name: 'national_id', hint: 'رقم الهوية' },
      { name: 'phone', hint: 'رقم الجوال' },
      { name: 'city', hint: 'المدينة' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { name: 'today', hint: 'تاريخ اليوم' },
      { name: 'platform_name', hint: 'اسم المنصة' },
    ],
  },
];

interface PreviewResult {
  output: string;
  used: string[];
  missing: string[];
}

export function TemplateEditor({
  initial,
  templateId,
  departments,
  requestTypes,
}: {
  initial: TemplateFormValue;
  templateId?: string;
  departments: ReadonlyArray<{ id: string; name: string }>;
  requestTypes: ReadonlyArray<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const [value, setValue] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [mode, setMode] = React.useState<'edit' | 'preview'>('edit');
  const [preview, setPreview] = React.useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  const set = <K extends keyof TemplateFormValue>(
    key: K,
    next: TemplateFormValue[K],
  ) => setValue((current) => ({ ...current, [key]: next }));

  const hasAiSlot = value.body.includes('{{ai_body}}');

  /** إدراج متغيّر عند موضع المؤشر — أسرع وأقل خطأً من الكتابة اليدوية. */
  function insertVariable(name: string) {
    const textarea = bodyRef.current;
    const token = `{{${name}}}`;

    if (!textarea) {
      set('body', value.body + token);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = value.body.slice(0, start) + token + value.body.slice(end);

    set('body', next);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function runPreview() {
    setPreviewing(true);
    setMode('preview');

    try {
      const response = await api.put<PreviewResult>('/api/admin/templates', {
        body: value.body,
      });
      setPreview(response.data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'تعذّرت المعاينة.',
      );
      setMode('edit');
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    reset();
    setPending(true);

    const payload = {
      ...value,
      departmentId: value.departmentId || null,
      requestTypeId: value.requestTypeId || null,
    };

    try {
      const response = templateId
        ? await api.patch<{ warnings: string[] }>(
            `/api/admin/templates/${templateId}`,
            payload,
          )
        : await api.post<{ warnings: string[] }>('/api/admin/templates', payload);

      toast.success('تم حفظ القالب');

      for (const warning of response.data.warnings ?? []) {
        toast.warning(warning);
      }

      router.push('/admin/templates');
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormError message={formError} />

      <FormSection title="بيانات القالب">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="t-name" label="اسم القالب" error={fieldErrors.name} required>
            {(props) => (
              <Input
                {...props}
                value={value.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="القالب الحكومي الافتراضي"
              />
            )}
          </FormField>

          <FormField id="t-slug" label="المعرّف" error={fieldErrors.slug} required>
            {(props) => (
              <Input
                {...props}
                value={value.slug}
                onChange={(event) => set('slug', event.target.value)}
                placeholder="default-government"
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField
            id="t-description"
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

      <FormSection
        title="نطاق القالب"
        description="القالب الأخص يُختار تلقائياً: (جهة + نوع) ثم (نوع) ثم (جهة) ثم الافتراضي."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="t-dept" label="الجهة">
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

          <FormField id="t-type" label="نوع الطلب">
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

        <div className="mt-4 space-y-3">
          <Toggle
            checked={value.isDefault}
            onChange={(next) => set('isDefault', next)}
            label="القالب الافتراضي"
            description="يُستخدم حين لا يطابق أي قالب آخر. قالب افتراضي واحد فقط في المنصة."
          />
          <Toggle
            checked={value.isActive}
            onChange={(next) => set('isActive', next)}
            label="القالب مُفعّل"
          />
        </div>
      </FormSection>

      {/* --- المتغيرات --- */}
      <FormSection
        title="المتغيرات المتاحة"
        description="انقر أي متغيّر لإدراجه عند موضع المؤشر. لمتغيرات الإجابات استخدم الصيغة {{a.question_key}}."
      >
        <div className="space-y-3">
          {VARIABLE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => insertVariable(item.name)}
                    title={item.hint}
                    className={cn(
                      'rounded-md border px-2 py-1 font-mono text-xs transition-colors',
                      item.name === 'ai_body'
                        ? 'border-primary bg-primary-subtle text-primary hover:bg-brand-100'
                        : 'border-border bg-surface-muted text-muted-foreground hover:border-primary hover:text-primary',
                    )}
                    dir="ltr"
                  >
                    {`{{${item.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              كتلة شرطية
            </p>
            <button
              type="button"
              onClick={() => {
                const token = '{{#if variable}}\n\n{{/if}}';
                set('body', `${value.body}\n${token}`);
              }}
              className="rounded-md border border-border bg-surface-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary"
              dir="ltr"
            >
              {'{{#if x}}…{{/if}}'}
            </button>
          </div>
        </div>
      </FormSection>

      {/* --- المحرر والمعاينة --- */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-[var(--radius-field)] border border-border bg-surface p-1"
            role="tablist"
            aria-label="وضع القالب"
          >
            {(
              [
                { value: 'edit', label: 'تحرير', icon: Code2 },
                { value: 'preview', label: 'معاينة', icon: Eye },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                onClick={() => {
                  if (tab.value === 'preview') void runPreview();
                  else setMode('edit');
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors',
                  mode === tab.value
                    ? 'bg-primary-subtle font-medium text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="size-4" aria-hidden />
                {tab.label}
              </button>
            ))}
          </div>

          {!hasAiSlot ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-danger-subtle px-3 py-1.5 text-xs text-danger">
              <AlertTriangle className="size-3.5" aria-hidden />
              ينقص {'{{ai_body}}'} — لن يظهر المحتوى المُولَّد
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(value.body)
                .then(() => toast.success('نُسخ القالب'));
            }}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Copy className="size-3.5" aria-hidden />
            نسخ
          </button>
        </div>

        {mode === 'edit' ? (
          <FormField id="t-body" label="نص القالب" error={fieldErrors.body} required>
            {(props) => (
              <Textarea
                {...props}
                ref={bodyRef}
                rows={22}
                value={value.body}
                onChange={(event) => set('body', event.target.value)}
                className="[font-family:var(--font-letter)] text-[0.95rem] leading-8"
              />
            )}
          </FormField>
        ) : (
          <div>
            {previewing ? (
              <div className="flex items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface py-20">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                <span className="sr-only">جارٍ إعداد المعاينة…</span>
              </div>
            ) : preview ? (
              <>
                {preview.missing.length > 0 ? (
                  <div className="mb-3 rounded-[var(--radius-field)] border border-warning/40 bg-warning-subtle px-4 py-3">
                    <p className="text-xs font-medium text-warning">
                      متغيرات بلا قيمة في بيانات المعاينة — ستظهر كعلامات نائبة:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {preview.missing.map((name) => (
                        <Badge key={name} tone="warning">
                          <span dir="ltr">{name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-white p-8 sm:p-12">
                  <pre className="whitespace-pre-wrap text-right text-[0.95rem] leading-8 text-[#111] [font-family:var(--font-letter)]">
                    {preview.output}
                  </pre>
                </div>

                <p className="mt-3 text-xs text-subtle-foreground">
                  معاينة ببيانات وهمية. المحتوى داخل {'{{ai_body}}'} يكتبه الذكاء
                  الاصطناعي من إجابات المستخدم الفعلية.
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>

      <FormActions
        onSave={() => void save()}
        pending={pending}
        saveLabel={templateId ? 'حفظ التعديلات' : 'إنشاء القالب'}
        cancelHref="/admin/templates"
      />
    </div>
  );
}
