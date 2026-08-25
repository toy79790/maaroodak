import { AppSidebar } from '@/components/layout/app-sidebar';
import { UserMenu } from '@/components/layout/user-menu';
import { requireAdmin } from '@/lib/auth/guards';
import { permissionsFor } from '@/lib/auth/rbac';
import { ADMIN_NAV } from '@/config/nav';

/**
 * تخطيط لوحة الإدارة.
 *
 * ⚠️ `requireAdmin` هنا يحمي **الصفحات فقط**. كل Route Handler تحت
 * `/api/admin/*` يستدعي `assertAdmin` بنفسه — التخطيط لا يعمل على مسارات
 * الـ API، والاعتماد عليه ثغرة كلاسيكية (docs/SECURITY.md §3).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar
        variant="admin"
        groups={ADMIN_NAV}
        permissions={permissionsFor(user.role)}
        footer={<UserMenu user={user} isAdmin />}
      />

      <div className="lg:ps-64">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          تخطَّ إلى المحتوى
        </a>
        <main
          id="admin-main"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
