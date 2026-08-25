import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { RequestTypesManager } from '@/features/admin/components/request-types-manager';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'أنواع الطلبات' };

export default async function AdminRequestTypesPage() {
  await requirePermission('requestType:manage');

  const requestTypes = await prisma.requestType.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      icon: true,
      isActive: true,
      order: true,
      _count: { select: { departments: true, questions: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="أنواع الطلبات"
        description="الكتالوج العام لأنواع الطلبات. ربطها بالجهات يتم من شاشة الجهات."
      />

      <RequestTypesManager
        rows={requestTypes.map((type) => ({
          id: type.id,
          slug: type.slug,
          name: type.name,
          description: type.description ?? '',
          icon: type.icon ?? '',
          isActive: type.isActive,
          order: type.order,
          departmentCount: type._count.departments,
          questionCount: type._count.questions,
        }))}
      />
    </>
  );
}
