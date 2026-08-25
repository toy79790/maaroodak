'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/**
 * لبنات نماذج الإدارة المشتركة.
 *
 * ستّ شاشات إدارة تشترك في نفس البنية (بطاقة · حقول · شريط حفظ) وفي نفس
 * أنماط الحقول. تجميعها هنا يمنع انحراف الشاشات عن بعضها بصرياً، ويجعل
 * تعديل نمط الحقل يسري على الجميع.
 */

export const adminSelectClass =
  'w-full rounded-[var(--radius-field)] border border-border-strong bg-surface px-3 py-2.5 text-sm ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ' +
  'aria-[invalid=true]:border-danger';

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** مفتاح تبديل — أوضح من صندوق اختيار لحالات التفعيل. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-sand-300',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow transition-transform',
            // RTL: المقبض يتحرك يساراً عند التفعيل.
            checked ? 'translate-x-[-1.15rem]' : 'translate-x-[-0.15rem]',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** شريط الحفظ السفلي — ثابت على الجوال حتى لا يختفي أسفل نموذج طويل. */
export function FormActions({
  onSave,
  pending,
  saveLabel,
  cancelHref,
  extra,
}: {
  onSave: () => void;
  pending?: boolean;
  saveLabel: string;
  cancelHref: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3',
        'max-lg:sticky max-lg:bottom-0 max-lg:-mx-4 max-lg:border-t max-lg:border-border',
        'max-lg:bg-background max-lg:px-4 max-lg:py-3',
      )}
    >
      <Button onClick={onSave} loading={pending} size="lg">
        {saveLabel}
      </Button>
      <Button variant="secondary" size="lg" asChild>
        <Link href={cancelHref}>إلغاء</Link>
      </Button>
      {extra ? <div className="ms-auto flex items-center gap-2">{extra}</div> : null}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowRight className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * تحويل أخطاء الحقول من الـ API إلى حالة النموذج.
 * منطق يتكرر في كل شاشة إدارة، وتكراره يدوياً يؤدي إلى نسيان أحدها.
 */
export function useFormErrors() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const reset = React.useCallback(() => {
    setFormError(null);
    setFieldErrors({});
  }, []);

  const apply = React.useCallback(
    (error: unknown, fallback = 'تعذّر الحفظ.') => {
      const apiError = error as { fields?: Record<string, string>; message?: string };
      const fields = apiError?.fields ?? {};

      setFieldErrors(fields);
      setFormError(
        Object.keys(fields).length > 0 ? null : (apiError?.message ?? fallback),
      );
    },
    [],
  );

  return { formError, fieldErrors, reset, apply, setFormError };
}
