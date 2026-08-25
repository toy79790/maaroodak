'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/shared/states';
import { searchKey } from '@/lib/utils/arabic';
import { cn } from '@/lib/utils/cn';

/**
 * جدول إداري بسيط ببحث محلي.
 *
 * البحث محلي لا خادمي عمداً: قوائم الإدارة بالعشرات لا بالآلاف، وجلبها
 * دفعة واحدة أسرع استجابةً وأبسط شيفرةً من ترقيم خادمي بلا حاجة فعلية.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** عرض الخلية. */
  cell: (row: T) => React.ReactNode;
  /** نص يُبحث فيه — إن غاب لا يُبحث في هذا العمود. */
  searchText?: (row: T) => string;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  emptyTitle,
  emptyDescription,
  emptyAction,
  searchPlaceholder = 'ابحث…',
  toolbar,
}: {
  rows: readonly T[];
  columns: ReadonlyArray<Column<T>>;
  getRowId: (row: T) => string;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const needle = searchKey(query.trim());
    if (!needle) return rows;

    return rows.filter((row) =>
      columns.some((column) =>
        column.searchText
          ? searchKey(column.searchText(row)).includes(needle)
          : false,
      ),
    );
  }, [rows, columns, query]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4.5 text-subtle-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="ps-11"
          />
        </div>
        {toolbar}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={query ? Search : undefined}
          title={query ? 'لا توجد نتائج' : emptyTitle}
          description={
            query ? `لم نجد ما يطابق «${query}».` : emptyDescription
          }
          action={query ? undefined : emptyAction}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-muted-foreground',
                      column.className,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={getRowId(row)} className="hover:bg-surface-muted/40">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-3 align-middle', column.className)}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-subtle-foreground">
        {filtered.length} من {rows.length}
      </p>
    </div>
  );
}
