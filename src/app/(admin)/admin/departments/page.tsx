import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { listDepartmentsAdmin } from '@/features/admin/queries';
import { DepartmentsTable } from '@/features/admin/components/departments-table';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'الجهات' };

export default async function AdminDepartmentsPage() {
  await requirePermission('department:manage');
  const departments = await listDepartmentsAdmin();

  return (
    <>
      <PageHeader
        title="الجهات"
        description="الجهات التي يستطيع المستخدمون مخاطبتها، وأنواع الطلبات المتاحة لكل منها."
      />

      <DepartmentsTable
        rows={departments.map((department) => ({
          id: department.id,
          slug: department.slug,
          name: department.name,
          category: department.category.name,
          isActive: department.isActive,
          order: department.order,
          requestTypeCount: department._count.requestTypes,
          letterCount: department._count.letters,
        }))}
      />
    </>
  );
}
