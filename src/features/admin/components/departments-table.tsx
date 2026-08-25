'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Pencil, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { DEPARTMENT_CATEGORY_LABEL } from '@/features/letters/labels';
import { api, ApiError } from '@/lib/api/client';

export interface DepartmentRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  isActive: boolean;
  order: number;
  requestTypeCount: number;
  letterCount: number;
}

export function DepartmentsTable({ rows }: { rows: readonly DepartmentRow[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState<DepartmentRow[]>([...rows]);

  React.useEffect(() => setItems([...rows]), [rows]);

  async function remove(row: DepartmentRow) {
    const warning =
      row.letterCount > 0
        ? `\n\nتنبيه: مرتبطة بـ ${row.letterCount} معروضاً. لن تُحذف تلك المعاريض، لكن الجهة ستختفي من الخيارات.`
        : '';

    if (!window.confirm(`سيتم تعطيل وحذف «${row.name}».${warning}\n\nمتابعة؟`)) {
      return;
    }

    const snapshot = items;
    setItems((current) => current.filter((item) => item.id !== row.id));

    try {
      await api.delete(`/api/admin/departments/${row.id}`);
      toast.success('تم حذف الجهة');
      router.refresh();
    } catch (error) {
      setItems(snapshot);
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحذف.');
    }
  }

  const columns: Array<Column<DepartmentRow>> = [
    {
      key: 'name',
      header: 'الجهة',
      searchText: (row) => `${row.name} ${row.slug}`,
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/departments/${row.id}`}
            className="block truncate font-medium hover:text-primary hover:underline"
          >
            {row.name}
          </Link>
          <code className="mt-0.5 block text-xs text-subtle-foreground" dir="ltr">
            {row.slug}
          </code>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'الفئة',
      searchText: (row) => DEPARTMENT_CATEGORY_LABEL[row.category] ?? row.category,
      cell: (row) => (
        <Badge tone="neutral">
          {DEPARTMENT_CATEGORY_LABEL[row.category] ?? row.category}
        </Badge>
      ),
    },
    {
      key: 'types',
      header: 'أنواع الطلبات',
      className: 'tabular',
      cell: (row) => row.requestTypeCount,
    },
    {
      key: 'letters',
      header: 'المعاريض',
      className: 'tabular',
      cell: (row) => row.letterCount,
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (row) =>
        row.isActive ? (
          <Badge tone="success">مُفعّلة</Badge>
        ) : (
          <Badge tone="danger">معطّلة</Badge>
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
            href={`/admin/departments/${row.id}`}
            aria-label={`تعديل ${row.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => void remove(row)}
            aria-label={`حذف ${row.name}`}
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
      searchPlaceholder="ابحث باسم الجهة أو معرّفها أو فئتها…"
      emptyTitle="لا توجد جهات"
      emptyDescription="أضف أول جهة ليتمكن المستخدمون من مخاطبتها."
      emptyAction={
        <Button asChild>
          <Link href="/admin/departments/new">
            <Plus className="size-4.5" />
            جهة جديدة
          </Link>
        </Button>
      }
      toolbar={
        <Button asChild>
          <Link href="/admin/departments/new">
            <Building2 className="size-4.5" />
            جهة جديدة
          </Link>
        </Button>
      }
    />
  );
}
