import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

/**
 * الحالات الأربع المطلوبة في كل شاشة — docs/ARCHITECTURE.md §11
 * Loading · Empty · Error(+Retry) · Success
 */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border-strong px-6 py-16 text-center',
        className,
      )}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
        <Icon className="size-7" aria-hidden />
      </span>
      <p className="mt-5 font-semibold">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description = 'حدث خطأ أثناء جلب البيانات. يمكنك إعادة المحاولة.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-danger/25 bg-danger-subtle px-6 py-14 text-center',
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-danger">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-danger/85">{description}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} aria-hidden />;
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      <span className="sr-only">جارٍ التحميل…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="surface-card space-y-3 p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
