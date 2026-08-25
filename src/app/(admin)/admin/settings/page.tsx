import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { listSettings } from '@/lib/db/repositories/settings-repository';
import { SettingsForm } from '@/features/admin/components/settings-form';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'إعدادات النظام' };

export default async function AdminSettingsPage() {
  await requirePermission('settings:manage');
  const settings = await listSettings();

  return (
    <>
      <PageHeader
        title="إعدادات النظام"
        description="النماذج والتكاليف والحدود. التعديل يسري بلا نشر."
      />
      <SettingsForm settings={settings} />
    </>
  );
}
