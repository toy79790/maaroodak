import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { listDepartments } from '@/lib/db/repositories/catalog-repository';
import { StartPicker } from '@/features/interview/components/start-picker';
import { CreditNotice } from '@/components/shared/credit-notice';
import { getSettings } from '@/lib/db/repositories/settings-repository';

export const metadata: Metadata = { title: 'معروض جديد' };

export default async function NewLetterPage() {
  const { user } = await requireUser();

  const [departments, settings] = await Promise.all([
    listDepartments({ organizationId: user.organizationId }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      {user.creditBalance < settings.creditCosts.GENERATE_LETTER ? (
        <CreditNotice context="start" className="mb-6" />
      ) : null}
      <StartPicker departments={departments} />
    </div>
  );
}
