'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle, adminSelectClass } from '@/features/admin/components/admin-form';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/**
 * إعدادات النظام.
 *
 * كل إعداد يُحفظ على حدة لا كنموذج واحد: النموذج الكامل يعني أن خطأ في
 * حقل يمنع حفظ الباقي، وأن المسؤول لا يعرف ما الذي حُفظ فعلاً.
 */

export interface SettingRow {
  key: string;
  value: unknown;
  category: string;
}

type FieldKind = 'text' | 'number' | 'boolean' | 'select';

interface FieldSpec {
  label: string;
  hint?: string;
  kind: FieldKind;
  options?: ReadonlyArray<{ value: string; label: string }>;
  min?: number;
  max?: number;
}

const MODEL_OPTIONS = [
  { value: 'claude-opus-5', label: 'Claude Opus 5 — الأدق ($5/$25)' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — متوازن ($3/$15)' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — الأرخص ($1/$5)' },
];

const EFFORT_OPTIONS = [
  { value: 'low', label: 'منخفض — أسرع وأرخص' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'عالٍ — الافتراضي للتوليد' },
  { value: 'xhigh', label: 'عالٍ جداً' },
  { value: 'max', label: 'أقصى — الأدق والأغلى' },
];

const FIELDS: Record<string, FieldSpec> = {
  'platform.name': { label: 'اسم المنصة', kind: 'text' },
  'platform.logoUrl': { label: 'رابط الشعار', kind: 'text' },
  'platform.supportEmail': { label: 'بريد الدعم', kind: 'text' },

  'credits.signupBonus': {
    label: 'رصيد الترحيب',
    hint: 'معاريض مجانية تُمنح عند إنشاء الحساب. الافتراضي صفر.',
    kind: 'number',
    min: 0,
    max: 1000,
  },
  'credits.costs.generate': { label: 'تكلفة إنشاء معروض', kind: 'number', min: 0, max: 100 },
  'credits.costs.regenerate': { label: 'تكلفة إعادة التوليد', kind: 'number', min: 0, max: 100 },
  'credits.costs.aiTool': {
    label: 'تكلفة أداة تحرير',
    hint: 'صفر = مشمولة مع المعروض ضمن الحد أدناه.',
    kind: 'number',
    min: 0,
    max: 100,
  },
  'credits.aiToolsPerLetter': {
    label: 'حد أدوات الذكاء الاصطناعي لكل معروض',
    hint: 'صفحة الأسعار تعرض الرقم الافتراضي (10) — غيّره هنا يغيّر التطبيق لا النص التسويقي.',
    kind: 'number',
    min: 0,
    max: 100,
  },
  'credits.costs.followUp': { label: 'تكلفة أسئلة المتابعة', kind: 'number', min: 0, max: 100 },
  'credits.costs.qualityCheck': { label: 'تكلفة فحص الجودة', kind: 'number', min: 0, max: 100 },

  'ai.model.generate': {
    label: 'نموذج التوليد',
    hint: 'المخرَج الأساسي — الجودة تسبق التكلفة.',
    kind: 'select',
    options: MODEL_OPTIONS,
  },
  'ai.model.tools': { label: 'نموذج الأدوات', kind: 'select', options: MODEL_OPTIONS },
  'ai.model.quality': { label: 'نموذج فحص الجودة', kind: 'select', options: MODEL_OPTIONS },
  'ai.model.followUp': { label: 'نموذج أسئلة المتابعة', kind: 'select', options: MODEL_OPTIONS },
  'ai.effort.generate': { label: 'عمق التوليد', kind: 'select', options: EFFORT_OPTIONS },
  'ai.effort.tools': { label: 'عمق الأدوات', kind: 'select', options: EFFORT_OPTIONS },
  'ai.maxTokens.generate': {
    label: 'حد رموز التوليد',
    kind: 'number',
    min: 512,
    max: 64000,
  },
  'ai.maxTokens.tools': { label: 'حد رموز الأدوات', kind: 'number', min: 512, max: 64000 },
  'ai.qualityCheck.enabled': {
    label: 'تفعيل فحص الجودة',
    hint: 'تعطيله يوفّر نداءً لكل معروض لكنه يُسقط الفحوص الثمانية.',
    kind: 'boolean',
  },
  'ai.followUp.enabled': { label: 'تفعيل أسئلة المتابعة', kind: 'boolean' },

  'limits.generatePerWindow': {
    label: 'حد التوليد لكل 10 دقائق',
    kind: 'number',
    min: 1,
    max: 100,
  },
  'limits.aiToolPerWindow': {
    label: 'حد الأدوات لكل 10 دقائق',
    kind: 'number',
    min: 1,
    max: 500,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام',
  credits: 'الرصيد والتكاليف',
  ai: 'الذكاء الاصطناعي',
  limits: 'حدود الاستخدام',
};

export function SettingsForm({ settings }: { settings: readonly SettingRow[] }) {
  const router = useRouter();
  const [values, setValues] = React.useState<Record<string, unknown>>(
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  const [saving, setSaving] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Record<string, number>>({});

  const original = React.useMemo(
    () => Object.fromEntries(settings.map((s) => [s.key, s.value])),
    [settings],
  );

  const grouped = React.useMemo(() => {
    const groups = new Map<string, SettingRow[]>();
    for (const setting of settings) {
      const list = groups.get(setting.category) ?? [];
      list.push(setting);
      groups.set(setting.category, list);
    }
    return [...groups.entries()];
  }, [settings]);

  async function save(key: string, value: unknown) {
    setSaving(key);

    try {
      await api.patch('/api/admin/settings', { key, value });
      setSavedAt((current) => ({ ...current, [key]: Date.now() }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحفظ.');
      setValues((current) => ({ ...current, [key]: original[key] }));
    } finally {
      setSaving(null);
    }
  }

  function renderField(setting: SettingRow) {
    const spec = FIELDS[setting.key];
    const value = values[setting.key];
    const isDirty = JSON.stringify(value) !== JSON.stringify(original[setting.key]);
    const justSaved = Date.now() - (savedAt[setting.key] ?? 0) < 3000;

    if (!spec) {
      return (
        <div key={setting.key} className="flex items-center justify-between gap-4 py-3">
          <code className="text-xs text-muted-foreground" dir="ltr">
            {setting.key}
          </code>
          <code className="text-xs" dir="ltr">
            {JSON.stringify(setting.value)}
          </code>
        </div>
      );
    }

    const inputId = `setting-${setting.key.replace(/\./g, '-')}`;

    return (
      <div key={setting.key} className="py-4">
        {spec.kind === 'boolean' ? (
          <Toggle
            checked={Boolean(value)}
            onChange={(next) => {
              setValues((current) => ({ ...current, [setting.key]: next }));
              void save(setting.key, next);
            }}
            label={spec.label}
            description={spec.hint}
          />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor={inputId} className="min-w-0 sm:w-1/2">
              <span className="block text-sm">{spec.label}</span>
              {spec.hint ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {spec.hint}
                </span>
              ) : null}
              <code className="mt-1 block text-xs text-subtle-foreground" dir="ltr">
                {setting.key}
              </code>
            </label>

            <div className="flex items-center gap-2 sm:w-1/2">
              {spec.kind === 'select' ? (
                <select
                  id={inputId}
                  value={String(value ?? '')}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [setting.key]: event.target.value,
                    }))
                  }
                  className={adminSelectClass}
                >
                  {spec.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={inputId}
                  type={spec.kind === 'number' ? 'number' : 'text'}
                  value={String(value ?? '')}
                  min={spec.min}
                  max={spec.max}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [setting.key]:
                        spec.kind === 'number'
                          ? Number(event.target.value)
                          : event.target.value,
                    }))
                  }
                />
              )}

              {isDirty ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => void save(setting.key, value)}
                    loading={saving === setting.key}
                  >
                    حفظ
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        [setting.key]: original[setting.key],
                      }))
                    }
                    aria-label="تراجع"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                </>
              ) : (
                <span
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center text-success transition-opacity',
                    justSaved ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                >
                  <Check className="size-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([category, items]) => (
        <Card key={category} className="p-5">
          <h2 className="mb-1 text-sm font-semibold">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="divide-y divide-border">{items.map(renderField)}</div>
        </Card>
      ))}

      <p className="text-xs text-subtle-foreground">
        كل إعداد يُحفظ على حدة ويسري خلال دقيقة على الأكثر.
      </p>
    </div>
  );
}
