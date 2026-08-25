import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { listLetters } from '@/features/letters/service';
import { listDepartments } from '@/lib/db/repositories/catalog-repository';
import { LettersList } from '@/features/letters/components/letters-list';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'المفضلة' };

export default async function FavoritesPage() {
  const { user } = await requireUser();

  const [letters, departments] = await Promise.all([
    listLetters(user.id, { favorite: true }),
    listDepartments({ organizationId: user.organizationId }),
  ]);

  return (
    <>
      <PageHeader
        title="المفضلة"
        description="المعاريض التي علّمتها بنجمة للرجوع إليها بسرعة."
      />

      <LettersList
        favoritesOnly
        initialItems={letters.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
        initialCursor={letters.nextCursor}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}
