'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  FilePlus2,
  Files,
  Star,
  Settings,
  CreditCard,
  Building2,
  ListTree,
  MessageSquareQuote,
  GitBranch,
  FileCode2,
  Sparkles,
  Users,
  BarChart3,
  ScrollText,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { cn } from '@/lib/utils/cn';
import type { NavGroup, NavIconName } from '@/config/nav';
import type { Permission } from '@/lib/auth/rbac';

/**
 * سجل الأيقونات — الربط بين اسم الأيقونة ومكوّنها يقع هنا (في العميل)
 * لأن مكوّنات React لا تعبر حدّ الخادم/العميل كـ props. انظر config/nav.ts
 */
const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  newLetter: FilePlus2,
  letters: Files,
  favorites: Star,
  credits: CreditCard,
  settings: Settings,
  departments: Building2,
  requestTypes: ListTree,
  questions: MessageSquareQuote,
  conditions: GitBranch,
  templates: FileCode2,
  prompts: Sparkles,
  users: Users,
  analytics: BarChart3,
  auditLogs: ScrollText,
  systemSettings: SlidersHorizontal,
};

function isActive(pathname: string, href: string, matchNested?: boolean): boolean {
  if (pathname === href) return true;
  return Boolean(matchNested) && pathname.startsWith(`${href}/`);
}

function NavLinks({
  groups,
  permissions,
  onNavigate,
}: {
  groups: readonly NavGroup[];
  permissions: readonly Permission[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6" aria-label="التنقل الجانبي">
      {groups.map((group, index) => {
        const visible = group.items.filter(
          (item) => !item.permission || permissions.includes(item.permission),
        );
        if (visible.length === 0) return null;

        return (
          <div key={group.label ?? index}>
            {group.label ? (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const active = isActive(pathname, item.href, item.matchNested);
                const Icon = NAV_ICONS[item.icon];

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 text-sm transition-colors',
                        active
                          ? 'bg-primary-subtle font-medium text-primary'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AppSidebar({
  groups,
  permissions,
  footer,
  variant = 'app',
}: {
  groups: readonly NavGroup[];
  permissions: readonly Permission[];
  footer?: React.ReactNode;
  variant?: 'app' | 'admin';
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = usePathname();

  // إغلاق قائمة الجوال عند تغيّر المسار — وإلا بقيت مفتوحة فوق الصفحة الجديدة.
  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const content = (
    <>
      <div className="px-3">
        <Logo href={variant === 'admin' ? '/admin' : '/dashboard'} />
        {variant === 'admin' ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-700">
            <ShieldCheck className="size-3.5" aria-hidden />
            لوحة الإدارة
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex-1 overflow-y-auto px-1">
        <NavLinks groups={groups} permissions={permissions} />
      </div>

      {variant === 'admin' ? (
        <Link
          href="/dashboard"
          className="mx-3 mb-2 flex items-center gap-2 rounded-[var(--radius-field)] px-3 py-2.5 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <ArrowRight className="size-4" aria-hidden />
          العودة للمنصة
        </Link>
      ) : null}

      {footer ? <div className="border-t border-border px-3 pt-3">{footer}</div> : null}
    </>
  );

  return (
    <>
      {/* شريط علوي للجوال */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Logo href={variant === 'admin' ? '/admin' : '/dashboard'} />
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="فتح القائمة"
          className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-surface-muted"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-border bg-surface py-5 lg:flex">
        {content}
      </aside>

      {/* درج الجوال */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-sand-950/40"
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-surface py-5 shadow-lift">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق القائمة"
              className="absolute top-4 end-4 inline-flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
