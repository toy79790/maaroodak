import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/auth-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import { requireGuest } from '@/lib/auth/guards';

export const metadata: Metadata = pageMetadata({
  title: 'تسجيل الدخول',
  description: 'سجّل الدخول إلى حسابك لمتابعة معاريضك.',
  path: '/login',
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireGuest();
  const { next } = await searchParams;

  // نقبل المسارات الداخلية فقط — منع إعادة توجيه مفتوحة.
  const redirectTo =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  return (
    <AuthShell
      title="تسجيل الدخول"
      description="أهلاً بعودتك. تابع من حيث توقفت."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            أنشئ حساباً
          </Link>
        </>
      }
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
