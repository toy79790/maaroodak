'use client';

import * as React from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError, FormField } from '@/components/shared/form-field';
import { api, ApiError } from '@/lib/api/client';
import { forgotPasswordSchema } from '@/features/auth/schema';

export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [devUrl, setDevUrl] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({ email: form.get('email') });

    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0]?.message ?? 'بريد غير صالح' });
      return;
    }

    setPending(true);
    try {
      const result = await api.post<{ devResetUrl?: string }>(
        '/api/auth/forgot-password',
        parsed.data,
      );
      setDevUrl(result.data.devResetUrl ?? null);
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'حدث خطأ غير متوقع.',
      );
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <div>
          <p className="font-medium">تحقّق من بريدك الإلكتروني</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            إن كان هذا البريد مسجّلاً لدينا، فستصلك رسالة تحتوي رابط إعادة تعيين
            كلمة المرور. الرابط صالح لمدة 30 دقيقة.
          </p>
        </div>

        {devUrl ? (
          <div className="rounded-[var(--radius-field)] border border-warning/40 bg-warning-subtle p-3 text-start">
            <p className="text-xs font-medium text-warning">
              وضع التطوير — رابط الاستعادة:
            </p>
            <Link
              href={devUrl}
              className="mt-1 block break-all text-xs text-primary underline"
            >
              {devUrl}
            </Link>
          </div>
        ) : null}

        <Button variant="secondary" block asChild>
          <Link href="/login">العودة لتسجيل الدخول</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={formError} />

      <FormField id="email" label="البريد الإلكتروني" error={fieldErrors.email} required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
        )}
      </FormField>

      <Button type="submit" block size="lg" loading={pending}>
        أرسل رابط الاستعادة
      </Button>
    </form>
  );
}
