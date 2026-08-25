import type { Metadata } from 'next';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell
      title="تعيين كلمة مرور جديدة"
      description="اختر كلمة مرور قوية لا تستخدمها في مواقع أخرى."
    >
      <ResetPasswordForm token={token ?? ''} />
    </AuthShell>
  );
}
