'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, History, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api/client';
import { formatArabicDate } from '@/lib/utils/arabic';
import { VERSION_SOURCE_LABEL } from '@/features/letters/labels';

export interface VersionRow {
  id: string;
  version: number;
  title: string;
  source: string;
  note: string | null;
  createdAt: string;
}

/**
 * سجل النسخ.
 *
 * الاستعادة تُنشئ نسخة **جديدة** بمحتوى القديمة ولا تحذف شيئاً — فالاستعادة
 * نفسها قابلة للتراجع (features/letters/service.ts).
 */
export function VersionsList({
  letterId,
  currentVersion,
  versions,
}: {
  letterId: string;
  currentVersion: number;
  versions: readonly VersionRow[];
}) {
  const router = useRouter();
  const [restoring, setRestoring] = React.useState<number | null>(null);

  async function restore(version: number) {
    if (
      !window.confirm(
        `ستُنشأ نسخة جديدة بمحتوى النسخة ${version}. لن يُحذف أي شيء. متابعة؟`,
      )
    ) {
      return;
    }

    setRestoring(version);
    try {
      await api.post(`/api/letters/${letterId}/versions`, { version });
      toast.success(`تمت استعادة النسخة ${version}`);
      router.push(`/letters/${letterId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّرت الاستعادة.');
      setRestoring(null);
    }
  }

  return (
    <div>
      <Link
        href={`/letters/${letterId}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        العودة للمعروض
      </Link>

      <ol className="space-y-3">
        {versions.map((version) => {
          const isCurrent = version.version === currentVersion;

          return (
            <li key={version.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="tabular inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-sm font-semibold text-muted-foreground">
                    {version.version}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{version.title}</p>
                      {isCurrent ? (
                        <Badge tone="success">
                          <Check className="size-3" aria-hidden />
                          الحالية
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <History className="size-3.5" aria-hidden />
                        {VERSION_SOURCE_LABEL[version.source] ?? version.source}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatArabicDate(new Date(version.createdAt))}</span>
                      {version.note ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{version.note}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                {!isCurrent ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void restore(version.version)}
                    loading={restoring === version.version}
                    className="sm:shrink-0"
                  >
                    <RotateCcw className="size-4" />
                    استعادة
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
