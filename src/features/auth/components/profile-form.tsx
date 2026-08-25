'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { FormError, FormField } from '@/components/shared/form-field';
import { PasswordInput } from '@/features/auth/components/password-input';
import { api, ApiError } from '@/lib/api/client';
import { updateProfileSchema, changePasswordSchema } from '@/features/auth/schema';
import { SAUDI_CITIES } from '@/config/constants';

/**
 * الملف الشخصي.
 *
 * البيانات هنا تُملأ تلقائياً في المعاريض، فتعبئتها مرة واحدة توفّر على
 * المستخدم إعادة كتابتها في كل مقابلة — وهذا سبب وجودها لا مجرد «إعدادات».
 */
export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    email: string;
    phone: string;
    nationalId: string;
    city: string;
  };
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = updateProfileSchema.safeParse({
      name: values.name,
      phone: values.phone,
      nationalId: values.nationalId,
      city: values.city,
    });

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
      await api.patch('/api/auth/me', parsed.data);
      toast.success('تم حفظ بياناتك');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError('تعذّر الحفظ.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <Card className="p-6">
        <h2 className="mb-1 font-semibold">البيانات الشخصية</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          تُستخدم تلقائياً في معاريضك، فلا تحتاج لكتابتها في كل مرة.
        </p>

        <FormError message={formError} />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            id="p-name"
            label="الاسم الكامل"
            error={fieldErrors.name}
            required
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
              />
            )}
          </FormField>

          <FormField id="p-email" label="البريد الإلكتروني">
            {(props) => (
              <Input {...props} type="email" value={values.email} disabled readOnly />
            )}
          </FormField>

          <FormField id="p-phone" label="رقم الجوال" error={fieldErrors.phone}>
            {(props) => (
              <Input
                {...props}
                type="tel"
                value={values.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="05XXXXXXXX"
              />
            )}
          </FormField>

          <FormField
            id="p-national-id"
            label="رقم الهوية"
            description="اختياري — يظهر في خانة بيانات المعروض."
            error={fieldErrors.nationalId}
          >
            {(props) => (
              <Input
                {...props}
                value={values.nationalId}
                onChange={(event) => set('nationalId', event.target.value)}
                placeholder="1XXXXXXXXX"
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="p-city" label="المدينة" error={fieldErrors.city}>
            {(props) => (
              <>
                <Input
                  {...props}
                  list="saudi-cities"
                  value={values.city}
                  onChange={(event) => set('city', event.target.value)}
                  placeholder="الرياض"
                />
                <datalist id="saudi-cities">
                  {SAUDI_CITIES.map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </>
            )}
          </FormField>
        </div>

        <Button type="submit" className="mt-6" loading={pending}>
          <Save className="size-4.5" />
          حفظ البيانات
        </Button>
      </Card>
    </form>
  );
}

export function ChangePasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = changePasswordSchema.safeParse({
      current: form.get('current'),
      next: form.get('next'),
    });

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
      const result = await api.post<{ revokedSessions: number }>(
        '/api/auth/change-password',
        parsed.data,
      );

      toast.success(
        result.data.revokedSessions > 0
          ? `تم تغيير كلمة المرور. سُجّل الخروج من ${result.data.revokedSessions} جهاز آخر.`
          : 'تم تغيير كلمة المرور.',
      );
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(Object.keys(error.fields).length ? null : error.message);
      } else {
        setFormError('تعذّر تغيير كلمة المرور.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6">
      <Card className="p-6">
        <h2 className="mb-1 font-semibold">كلمة المرور</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          سيتم تسجيل الخروج من الأجهزة الأخرى، وتبقى جلستك الحالية.
        </p>

        <FormError message={formError} />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            id="cp-current"
            label="كلمة المرور الحالية"
            error={fieldErrors.current}
            required
          >
            {(props) => (
              <PasswordInput {...props} name="current" autoComplete="current-password" />
            )}
          </FormField>

          <FormField
            id="cp-next"
            label="كلمة المرور الجديدة"
            error={fieldErrors.next}
            required
          >
            {(props) => (
              <PasswordInput {...props} name="next" autoComplete="new-password" />
            )}
          </FormField>
        </div>

        <Button type="submit" variant="secondary" className="mt-6" loading={pending}>
          تغيير كلمة المرور
        </Button>
      </Card>
    </form>
  );
}
