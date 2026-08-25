import { AppSidebar } from '@/components/layout/app-sidebar';
import { UserMenu } from '@/components/layout/user-menu';
import { requireUser } from '@/lib/auth/guards';
import { isAdminRole, permissionsFor } from '@/lib/auth/rbac';
import { USER_NAV } from '@/config/nav';

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireUser();

  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar
        groups={USER_NAV}
        permissions={permissionsFor(user.role)}
        footer={<UserMenu user={user} isAdmin={isAdminRole(user.role)} />}
      />

      <div className="lg:ps-64">
        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          تخطَّ إلى المحتوى
        </a>
        <main id="app-main" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
