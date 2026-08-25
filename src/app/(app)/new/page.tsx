import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { listDepartments } from '@/lib/db/repositories/catalog-repository';
import { StartPicker } from '@/features/interview/components/start-picker';

export const metadata: Metadata = { title: 'معروض جديد' };

export default async function NewLetterPage() {
  const { user } = await requireUser();

  const departments = await listDepartments({
    organizationId: user.organizationId,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <StartPicker departments={departments} />
    </div>
  );
}
