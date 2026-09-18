import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { DepartmentForm } from '@/features/admin/components/department-form';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';
import { listCategoryOptions } from '@/features/admin/queries';

export const metadata: Metadata = { title: 'تعديل الجهة' };

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('department:manage');
  const { id } = await params;

  const [department, requestTypes, categories] = await Promise.all([
    prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: {
        slug: true,
        name: true,
        nameEn: true,
        categoryId: true,
        description: true,
        honorific: true,
        addressee: true,
        order: true,
        isActive: true,
        requestTypes: {
          where: { isActive: true },
          select: { requestTypeId: true },
        },
      },
    }),
    prisma.requestType.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    listCategoryOptions(),
  ]);

  if (!department) notFound();

  return (
    <>
      <BackLink href="/admin/departments" label="الجهات" />
      <PageHeader title="تعديل الجهة" description={department.name} />

      <DepartmentForm
        departmentId={id}
        requestTypes={requestTypes}
        categories={categories}
        initial={{
          slug: department.slug,
          name: department.name,
          nameEn: department.nameEn ?? '',
          categoryId: department.categoryId,
          description: department.description ?? '',
          honorific: department.honorific ?? '',
          addressee: department.addressee ?? '',
          order: department.order,
          isActive: department.isActive,
          requestTypeIds: department.requestTypes.map((link) => link.requestTypeId),
        }}
      />
    </>
  );
}
