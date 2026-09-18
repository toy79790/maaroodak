import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { requireGuest } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'استعادة كلمة المرور',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  await requireGuest();

  return (
    <AuthShell
      title="استعادة كلمة المرور"
      description="أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور."
      footer={
        <>
          تذكّرتها؟{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
