import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { listCategoriesAdmin } from '@/features/admin/queries';
import { CategoriesManager } from '@/features/admin/components/categories-manager';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'فئات الجهات' };

export default async function AdminCategoriesPage() {
  await requirePermission('department:manage');
  const categories = await listCategoriesAdmin();

  return (
    <>
      <PageHeader
        title="فئات الجهات"
        description="تجميع الجهات في شاشة الاختيار وصفحة الجهات العامة. ترتيب الفئة يحدّد ترتيب ظهور مجموعتها."
      />

      <CategoriesManager
        rows={categories.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description ?? '',
          isActive: category.isActive,
          order: category.order,
          departmentCount: category._count.departments,
        }))}
      />
    </>
  );
}
