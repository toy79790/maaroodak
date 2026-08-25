import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { listUsersAdmin } from '@/features/admin/queries';
import { UsersTable } from '@/features/admin/components/users-table';
import { PageHeader } from '@/components/shared/states';
import { can } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'المستخدمون' };

export default async function AdminUsersPage() {
  const { user } = await requirePermission('user:read');
  const users = await listUsersAdmin();

  return (
    <>
      <PageHeader
        title="المستخدمون"
        description="أحدث 100 مستخدم. الأدوار والرصيد قابلة للتعديل مع تسجيل كل عملية في سجل التدقيق."
      />

      <UsersTable
        currentUserId={user.id}
        canManage={can(user.role, 'user:manage')}
        rows={users.map((row) => ({
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role,
          isActive: row.isActive,
          creditBalance: row.creditBalance,
          letterCount: row._count.letters,
          createdAt: row.createdAt.toISOString(),
          lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
