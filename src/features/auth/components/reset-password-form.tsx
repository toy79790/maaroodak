'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormError, FormField } from '@/components/shared/form-field';
import { PasswordInput } from '@/features/auth/components/password-input';
import { api, ApiError } from '@/lib/api/client';
import { resetPasswordSchema } from '@/features/auth/schema';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  if (!token) {
    return (
      <div className="space-y-4">
        <FormError message="رابط الاستعادة غير صالح أو ناقص." />
        <Button variant="secondary" block asChild>
          <Link href="/forgot-password">طلب رابط جديد</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (password !== confirm) {
      setFieldErrors({ confirm: 'كلمتا المرور غير متطابقتين.' });
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0] ?? '')] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setPending(true);
    try {
      await api.post('/api/auth/reset-password', parsed.data);
      toast.success('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.');
      router.push('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError('حدث خطأ غير متوقع.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormError message={formError} />

      <FormField
        id="password"
        label="كلمة المرور الجديدة"
        error={fieldErrors.password ?? fieldErrors.token}
        required
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        )}
      </FormField>

      <FormField
        id="confirm"
        label="تأكيد كلمة المرور"
        error={fieldErrors.confirm}
        required
      >
        {(props) => (
          <PasswordInput
            {...props}
            name="confirm"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        )}
      </FormField>

      <p className="text-xs text-muted-foreground">
        سيتم تسجيل الخروج من جميع الأجهزة بعد تغيير كلمة المرور.
      </p>

      <Button type="submit" block size="lg" loading={pending}>
        تعيين كلمة المرور
      </Button>
    </form>
  );
}
