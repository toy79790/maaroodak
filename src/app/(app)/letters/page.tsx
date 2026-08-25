import type { Metadata } from 'next';
import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { listLetters } from '@/features/letters/service';
import { listDepartments } from '@/lib/db/repositories/catalog-repository';
import { LettersList } from '@/features/letters/components/letters-list';
import { PageHeader } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'معاريضي' };

export default async function LettersPage() {
  const { user } = await requireUser();

  const [letters, departments] = await Promise.all([
    listLetters(user.id, {}),
    listDepartments({ organizationId: user.organizationId }),
  ]);

  return (
    <>
      <PageHeader
        title="معاريضي"
        description="كل ما كتبته، مُصنَّفاً وقابلاً للبحث."
        actions={
          <Button asChild>
            <Link href="/new">
              <FilePlus2 className="size-4.5" />
              معروض جديد
            </Link>
          </Button>
        }
      />

      <LettersList
        initialItems={letters.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
        initialCursor={letters.nextCursor}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
      />
    </>
  );
}
