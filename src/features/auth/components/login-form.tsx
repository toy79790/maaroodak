'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError, FormField } from '@/components/shared/form-field';
import { PasswordInput } from '@/features/auth/components/password-input';
import { api, ApiError } from '@/lib/api/client';
import { loginSchema } from '@/features/auth/schema';

export function LoginForm({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setPending(true);
    try {
      await api.post('/api/auth/login', parsed.data);
      // refresh قبل push: يضمن أن تخطيط الخادم يرى الجلسة الجديدة.
      router.refresh();
      router.push(redirectTo);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError('حدث خطأ غير متوقع. حاول مرة أخرى.');
      }
      setPending(false);
    }
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

      <FormField id="password" label="كلمة المرور" error={fieldErrors.password} required>
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        )}
      </FormField>

      <div className="flex justify-start">
        <Link
          href="/forgot-password"
          className="text-sm text-primary hover:underline"
        >
          نسيت كلمة المرور؟
        </Link>
      </div>

      <Button type="submit" block size="lg" loading={pending}>
        تسجيل الدخول
      </Button>
    </form>
  );
}
