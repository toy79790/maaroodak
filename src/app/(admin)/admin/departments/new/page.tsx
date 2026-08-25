import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  DepartmentForm,
  EMPTY_DEPARTMENT,
} from '@/features/admin/components/department-form';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';

export const metadata: Metadata = { title: 'جهة جديدة' };

export default async function NewDepartmentPage() {
  await requirePermission('department:manage');

  const requestTypes = await prisma.requestType.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <>
      <BackLink href="/admin/departments" label="الجهات" />
      <PageHeader
        title="جهة جديدة"
        description="ستظهر للمستخدمين فور الحفظ بلا حاجة إلى نشر."
      />
      <DepartmentForm initial={EMPTY_DEPARTMENT} requestTypes={requestTypes} />
    </>
  );
}
