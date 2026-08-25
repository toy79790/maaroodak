'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * حدّ الخطأ العام.
 * لا يعرض رسالة الخطأ ولا أثر المكدّس — رمز `digest` فقط ليطابقه الدعم
 * بسجل الخادم (docs/ARCHITECTURE.md §11).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-danger-subtle text-danger">
        <AlertTriangle className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-bold">حدث خطأ غير متوقع</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        تعذّر عرض هذه الصفحة. يمكنك إعادة المحاولة، وإن تكرر الأمر تواصل مع الدعم.
      </p>
      {error.digest ? (
        <p className="tabular mt-3 text-xs text-subtle-foreground">
          رمز الخطأ: {error.digest}
        </p>
      ) : null}
      <Button className="mt-8" onClick={reset}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
