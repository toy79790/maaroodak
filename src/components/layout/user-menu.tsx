'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Settings, ShieldCheck, Coins } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { SessionUser } from '@/lib/auth/session';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export function UserMenu({
  user,
  isAdmin,
}: {
  user: SessionUser;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function logout() {
    setPending(true);
    try {
      await api.post('/api/auth/logout');
    } finally {
      router.refresh();
      router.push('/');
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex w-full items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 text-start',
          'transition-colors hover:bg-surface-muted data-[state=open]:bg-surface-muted',
        )}
      >
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary"
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 min-w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lift"
        >
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" aria-hidden />
              الرصيد
            </span>
            <span className="tabular text-sm font-semibold">{user.creditBalance}</span>
          </div>

          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

          {isAdmin ? (
            <DropdownMenu.Item asChild>
              <Link
                href="/admin"
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted"
              >
                <ShieldCheck className="size-4" aria-hidden />
                لوحة الإدارة
              </Link>
            </DropdownMenu.Item>
          ) : null}

          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted"
            >
              <Settings className="size-4" aria-hidden />
              الإعدادات
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              void logout();
            }}
            disabled={pending}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-subtle"
          >
            <LogOut className="size-4" aria-hidden />
            {pending ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
