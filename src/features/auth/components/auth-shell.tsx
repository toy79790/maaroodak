import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

/** إطار موحّد لصفحات المصادقة. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-muted/50">
      <header className="p-6">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="surface-card p-7 sm:p-8">
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>

          {footer ? (
            <div className="mt-5 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}

          <p className="mt-8 text-center text-xs text-subtle-foreground">
            بالمتابعة أنت توافق على{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              شروط الاستخدام
            </Link>{' '}
            و{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              سياسة الخصوصية
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
