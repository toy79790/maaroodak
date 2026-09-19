import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { RegisterForm } from '@/features/auth/components/register-form';
import { requireGuest } from '@/lib/auth/guards';

export const metadata: Metadata = pageMetadata({
  title: 'إنشاء حساب',
  description: 'أنشئ حسابك وابدأ كتابة معروضك في دقائق.',
  path: '/register',
});

export default async function RegisterPage() {
  await requireGuest();

  return (
    <AuthShell
      title="أنشئ حسابك"
      description="دقيقة واحدة، ثم ابدأ بكتابة معروضك الأول."
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
