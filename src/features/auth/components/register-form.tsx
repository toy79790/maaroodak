'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError, FormField } from '@/components/shared/form-field';
import { PasswordInput } from '@/features/auth/components/password-input';
import { api, ApiError } from '@/lib/api/client';
import { registerSchema } from '@/features/auth/schema';
import { PRICE_PER_LETTER_SAR } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

/** مؤشر قوة بسيط وصادق — لا يَعِد بأمان، بل يوجّه نحو كلمة أطول. */
function PasswordHints({ value }: { value: string }) {
  const rules = [
    { label: '8 أحرف على الأقل', met: value.length >= 8 },
    { label: 'حرف ورقم على الأقل', met: /[A-Za-z؀-ۿ]/.test(value) && /\d/.test(value) },
  ];

  if (value.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-1.5 text-xs',
            rule.met ? 'text-success' : 'text-muted-foreground',
          )}
        >
          <Check
            className={cn('size-3.5', !rule.met && 'opacity-30')}
            aria-hidden
          />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

export function RegisterForm({ redirectTo = '/dashboard' }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      name: form.get('name'),
      email: form.get('email'),
      password: form.get('password'),
      phone: form.get('phone') ?? '',
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
      await api.post('/api/auth/register', parsed.data);
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

      <FormField id="name" label="الاسم الكامل" error={fieldErrors.name} required>
        {(props) => (
          <Input
            {...props}
            name="name"
            autoComplete="name"
            placeholder="محمد بن عبدالله"
            required
          />
        )}
      </FormField>

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

      <FormField
        id="phone"
        label="رقم الجوال"
        description="اختياري — يُستخدم في بيانات المعروض لتوفير الوقت لاحقاً."
        error={fieldErrors.phone}
      >
        {(props) => (
          <Input
            {...props}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="05XXXXXXXX"
          />
        )}
      </FormField>

      <FormField id="password" label="كلمة المرور" error={fieldErrors.password} required>
        {(props) => (
          <>
            <PasswordInput
              {...props}
              name="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <PasswordHints value={password} />
          </>
        )}
      </FormField>

      <Button type="submit" block size="lg" loading={pending}>
        إنشاء الحساب
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        إنشاء الحساب مجاني. المعروض الواحد بـ{PRICE_PER_LETTER_SAR} ريالاً شاملة الضريبة.
      </p>
    </form>
  );
}
