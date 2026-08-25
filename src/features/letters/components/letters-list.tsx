'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Search,
  Star,
  FilePlus2,
  Files,
  MoreHorizontal,
  Copy,
  Trash2,
  FileDown,
  Loader2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/states';
import { api, ApiError } from '@/lib/api/client';
import { formatArabicDate } from '@/lib/utils/arabic';
import { LETTER_STATUS_LABEL, LETTER_STATUS_TONE } from '@/features/letters/labels';
import { cn } from '@/lib/utils/cn';

export interface LetterRow {
  id: string;
  title: string;
  status: string;
  isFavorite: boolean;
  createdAt: string;
  departmentName: string;
  requestTypeName: string;
  excerpt: string;
}

interface FilterOption {
  id: string;
  name: string;
}

/**
 * قائمة «معاريضي» مع بحث وفلاتر وترقيم بالمؤشّر.
 *
 * البحث مؤجَّل (debounce) لا فوري: كل ضغطة مفتاح تعني استعلام قاعدة بيانات
 * على حقل نصي، وهو أثقل استعلام في الصفحة.
 */
export function LettersList({
  initialItems,
  initialCursor,
  departments,
  favoritesOnly,
}: {
  initialItems: readonly LetterRow[];
  initialCursor: string | null;
  departments: readonly FilterOption[];
  favoritesOnly?: boolean;
}) {
  const router = useRouter();

  const [items, setItems] = React.useState<LetterRow[]>([...initialItems]);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [query, setQuery] = React.useState('');
  const [departmentId, setDepartmentId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const isFirstRender = React.useRef(true);

  const fetchPage = React.useCallback(
    async (options: { cursor?: string | null; append?: boolean }) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (departmentId) params.set('departmentId', departmentId);
      if (favoritesOnly) params.set('favorite', 'true');
      if (options.cursor) params.set('cursor', options.cursor);

      const response = await api.get<LetterRow[]>(`/api/letters?${params}`);

      setItems((current) =>
        options.append ? [...current, ...response.data] : response.data,
      );
      setCursor(response.meta?.nextCursor ?? null);
    },
    [query, departmentId, favoritesOnly],
  );

  // بحث/فلترة مؤجَّلان 350 مللي ثانية.
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetchPage({})
        .catch((error: unknown) =>
          toast.error(
            error instanceof ApiError ? error.message : 'تعذّر جلب المعاريض.',
          ),
        )
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [query, departmentId, fetchPage]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      await fetchPage({ cursor, append: true });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر جلب المزيد.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`سيُحذف «${title}». هل أنت متأكد؟`)) return;

    const snapshot = items;
    setItems((current) => current.filter((item) => item.id !== id));

    try {
      await api.delete(`/api/letters/${id}`);
      toast.success('تم حذف المعروض');
      router.refresh();
    } catch (error) {
      setItems(snapshot);
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحذف.');
    }
  }

  async function toggleFavorite(id: string, current: boolean) {
    setItems((rows) =>
      rows.map((row) => (row.id === id ? { ...row, isFavorite: !current } : row)),
    );

    try {
      await api.post(`/api/letters/${id}/favorite`, { value: !current });
    } catch {
      setItems((rows) =>
        rows.map((row) => (row.id === id ? { ...row, isFavorite: current } : row)),
      );
      toast.error('تعذّر تحديث المفضلة.');
    }
  }

  const hasFilters = query.trim().length > 0 || departmentId.length > 0;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4.5 text-subtle-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث في عناوين ومحتوى معاريضك…"
            aria-label="ابحث في المعاريض"
            className="ps-11"
          />
        </div>

        <select
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          aria-label="فلترة بالجهة"
          className="rounded-[var(--radius-field)] border border-border-strong bg-surface px-3.5 py-2.5 text-sm sm:w-56"
        >
          <option value="">كل الجهات</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2.5" aria-busy>
          <span className="sr-only">جارٍ البحث…</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton h-24 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={hasFilters ? Search : Files}
          title={hasFilters ? 'لا توجد نتائج' : 'لم تكتب معروضاً بعد'}
          description={
            hasFilters
              ? 'جرّب كلمات بحث أخرى أو أزل الفلاتر.'
              : 'ابدأ بمعروضك الأول — لن يستغرق الأمر أكثر من دقائق.'
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setDepartmentId('');
                }}
              >
                مسح الفلاتر
              </Button>
            ) : (
              <Button asChild>
                <Link href="/new">
                  <FilePlus2 className="size-4.5" />
                  معروض جديد
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-2.5">
            {items.map((letter) => (
              <li
                key={letter.id}
                className="group relative rounded-[var(--radius-card)] border border-border bg-surface transition-colors hover:border-border-strong"
              >
                <Link href={`/letters/${letter.id}`} className="block p-4 pe-24">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                      <Files className="size-4.5" aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{letter.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {letter.excerpt}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{letter.departmentName}</span>
                        <span aria-hidden>·</span>
                        <span>{letter.requestTypeName}</span>
                        <span aria-hidden>·</span>
                        <span>{formatArabicDate(new Date(letter.createdAt))}</span>
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="absolute end-3 top-3 flex items-center gap-1">
                  <Badge tone={LETTER_STATUS_TONE[letter.status] ?? 'neutral'}>
                    {LETTER_STATUS_LABEL[letter.status] ?? letter.status}
                  </Badge>

                  <button
                    type="button"
                    onClick={() => void toggleFavorite(letter.id, letter.isFavorite)}
                    aria-label={
                      letter.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'
                    }
                    aria-pressed={letter.isFavorite}
                    className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface-muted"
                  >
                    <Star
                      className={cn(
                        'size-4',
                        letter.isFavorite
                          ? 'fill-accent-500 text-accent-500'
                          : 'text-muted-foreground',
                      )}
                    />
                  </button>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                      aria-label="خيارات المعروض"
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted"
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={6}
                        className="z-50 min-w-44 rounded-xl border border-border bg-surface p-1.5 shadow-lift"
                      >
                        <DropdownMenu.Item asChild>
                          <a
                            href={`/api/letters/${letter.id}/export?format=docx`}
                            download
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted"
                          >
                            <FileDown className="size-4" aria-hidden />
                            تحميل Word
                          </a>
                        </DropdownMenu.Item>

                        <DropdownMenu.Item
                          onSelect={() => {
                            void navigator.clipboard
                              .writeText(letter.excerpt)
                              .then(() => toast.success('نُسخ المقتطف'));
                          }}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted"
                        >
                          <Copy className="size-4" aria-hidden />
                          نسخ مقتطف
                        </DropdownMenu.Item>

                        <DropdownMenu.Separator className="my-1.5 h-px bg-border" />

                        <DropdownMenu.Item
                          onSelect={(event) => {
                            event.preventDefault();
                            void remove(letter.id, letter.title);
                          }}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-subtle"
                        >
                          <Trash2 className="size-4" aria-hidden />
                          حذف
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </li>
            ))}
          </ul>

          {cursor ? (
            <div className="mt-6 text-center">
              <Button
                variant="secondary"
                onClick={() => void loadMore()}
                loading={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                عرض المزيد
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
