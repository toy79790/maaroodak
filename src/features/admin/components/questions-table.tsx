'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GitBranch, Pencil, Trash2, MessageSquareQuote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { QUESTION_TYPE_LABEL } from '@/features/letters/labels';
import { api, ApiError } from '@/lib/api/client';

export interface QuestionRow {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  isActive: boolean;
  departmentName: string | null;
  requestTypeName: string | null;
  optionCount: number;
  conditionCount: number;
}

export function QuestionsTable({ rows }: { rows: readonly QuestionRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState<QuestionRow[]>([...rows]);

  React.useEffect(() => setItems([...rows]), [rows]);

  async function remove(row: QuestionRow) {
    if (
      !window.confirm(
        `سيُحذف السؤال «${row.label}». المعاريض السابقة لن تتأثر. متابعة؟`,
      )
    ) {
      return;
    }

    const snapshot = items;
    setItems((current) => current.filter((item) => item.id !== row.id));

    try {
      await api.delete(`/api/admin/questions/${row.id}`);
      toast.success('تم حذف السؤال');
      router.refresh();
    } catch (error) {
      setItems(snapshot);
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحذف.');
    }
  }

  const columns: Array<Column<QuestionRow>> = [
    {
      key: 'label',
      header: 'السؤال',
      searchText: (row) => `${row.label} ${row.key}`,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/questions/${row.id}`}
            className="block max-w-md truncate font-medium hover:text-primary hover:underline"
          >
            {row.label}
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
      searchText: (row) => QUESTION_TYPE_LABEL[row.type] ?? row.type,
      cell: (row) => (
        <Badge tone="neutral">{QUESTION_TYPE_LABEL[row.type] ?? row.type}</Badge>
      ),
    },
    {
      key: 'scope',
      header: 'النطاق',
      searchText: (row) =>
        `${row.departmentName ?? ''} ${row.requestTypeName ?? ''}`,
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.departmentName ? (
            <Badge tone="brand">{row.departmentName}</Badge>
          ) : null}
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
      key: 'meta',
      header: 'الخصائص',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.required ? <Badge tone="warning">مطلوب</Badge> : null}
          {row.conditionCount > 0 ? (
            <Badge tone="brand" className="tabular">
              <GitBranch className="size-3" aria-hidden />
              {row.conditionCount}
            </Badge>
          ) : null}
          {row.optionCount > 0 ? (
            <span className="tabular text-xs text-muted-foreground">
              {row.optionCount} خيار
            </span>
          ) : null}
          {!row.isActive ? <Badge tone="danger">معطّل</Badge> : null}
        </div>
      ),
    },
    {
      key: 'order',
      header: 'الترتيب',
      className: 'tabular w-20',
      cell: (row) => row.order,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/admin/questions/${row.id}`}
            aria-label={`تعديل ${row.label}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => void remove(row)}
            aria-label={`حذف ${row.label}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={items}
      columns={columns}
      getRowId={(row) => row.id}
      searchPlaceholder="ابحث بنص السؤال أو المفتاح أو النطاق…"
      emptyTitle="لا توجد أسئلة"
      emptyDescription="ابدأ ببناء بنك الأسئلة لجهاتك."
      emptyAction={
        <Button asChild>
          <Link href="/admin/questions/new">
            <MessageSquareQuote className="size-4.5" />
            سؤال جديد
          </Link>
        </Button>
      }
    />
  );
}
