'use client';

import Link from 'next/link';
import { Pencil, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { PROMPT_TYPE_LABELS } from '@/features/admin/components/prompt-editor';
import { formatArabicDate } from '@/lib/utils/arabic';

export interface PromptRow {
  id: string;
  key: string;
  name: string;
  type: string;
  isActive: boolean;
  model: string | null;
  departmentName: string | null;
  requestTypeName: string | null;
  updatedAt: string;
}

/** الموجّهات الأساسية تُبرز — تعديلها يؤثر على كل معروض في المنصة. */
const CORE_TYPES = new Set(['SYSTEM', 'GENERATION', 'QUALITY_CHECK', 'FOLLOW_UP']);

export function PromptsTable({ rows }: { rows: readonly PromptRow[] }) {
  const columns: Array<Column<PromptRow>> = [
    {
      key: 'name',
      header: 'الموجّه',
      searchText: (row) =>
        `${row.name} ${row.key} ${PROMPT_TYPE_LABELS[row.type] ?? row.type}`,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/prompts/${row.id}`}
            className="block max-w-sm truncate font-medium hover:text-primary hover:underline"
          >
            {row.name}
          </Link>
          <code className="mt-0.5 block text-xs text-subtle-foreground" dir="ltr">
            {row.key}
          </code>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'النوع',
      cell: (row) => (
        <Badge tone={CORE_TYPES.has(row.type) ? 'brand' : 'neutral'}>
          {PROMPT_TYPE_LABELS[row.type] ?? row.type}
        </Badge>
      ),
    },
    {
      key: 'scope',
      header: 'النطاق',
      searchText: (row) => `${row.departmentName ?? ''} ${row.requestTypeName ?? ''}`,
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.departmentName ? <Badge tone="info">{row.departmentName}</Badge> : null}
          {row.requestTypeName ? (
            <Badge tone="info">{row.requestTypeName}</Badge>
          ) : null}
          {!row.departmentName && !row.requestTypeName ? (
            <span className="text-xs text-muted-foreground">عام</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'model',
      header: 'النموذج',
      cell: (row) =>
        row.model ? (
          <code className="text-xs" dir="ltr">
            {row.model}
          </code>
        ) : (
          <span className="text-xs text-muted-foreground">افتراضي</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (row) =>
        row.isActive ? (
          <Badge tone="success">مُفعّل</Badge>
        ) : (
          <Badge tone="danger">معطّل</Badge>
        ),
    },
    {
      key: 'updated',
      header: 'آخر تعديل',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      cell: (row) => formatArabicDate(new Date(row.updatedAt)),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      cell: (row) => (
        <div className="flex justify-end">
          <Link
            href={`/admin/prompts/${row.id}`}
            aria-label={`تعديل ${row.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      searchPlaceholder="ابحث بالاسم أو المفتاح أو النوع…"
      emptyTitle="لا توجد موجّهات"
      emptyDescription="التوليد يحتاج موجّه أسلوب وموجّه توليد على الأقل."
      emptyAction={
        <Button asChild>
          <Link href="/admin/prompts/new">
            <Sparkles className="size-4.5" />
            موجّه جديد
          </Link>
        </Button>
      }
    />
  );
}
