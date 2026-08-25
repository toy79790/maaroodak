import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { listVersions, getLetter } from '@/features/letters/service';
import { VersionsList } from '@/features/letters/components/versions-list';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'سجل النسخ' };

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireUser();
  const { id } = await params;

  const [letter, versions] = await Promise.all([
    getLetter(user.id, id),
    listVersions(user.id, id),
  ]);

  if (!letter.ok || !versions.ok) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="سجل النسخ"
        description={`${letter.data.title} — كل تعديل محفوظ كنسخة مستقلة يمكنك الرجوع إليها.`}
      />

      <VersionsList
        letterId={id}
        currentVersion={letter.data.currentVersion}
        versions={versions.data.map((version) => ({
          ...version,
          createdAt: version.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
