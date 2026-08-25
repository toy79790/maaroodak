import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import {
  ChangePasswordForm,
  ProfileForm,
} from '@/features/auth/components/profile-form';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'الإعدادات' };

export default async function SettingsPage() {
  const { user } = await requireUser();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="الإعدادات"
        description="بياناتك الشخصية وكلمة المرور."
      />

      <ProfileForm
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          nationalId: user.nationalId ?? '',
          city: user.city ?? '',
        }}
      />

      <ChangePasswordForm />
    </div>
  );
}
