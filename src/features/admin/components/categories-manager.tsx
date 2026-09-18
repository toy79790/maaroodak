'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, FolderTree } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormError, FormField } from '@/components/shared/form-field';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { FormSection, Toggle, useFormErrors } from '@/features/admin/components/admin-form';
import { api, ApiError } from '@/lib/api/client';

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  order: number;
  departmentCount: number;
}

type Draft = Omit<CategoryRow, 'id' | 'departmentCount'> & { id?: string };

const EMPTY: Draft = {
  slug: '',
  name: '',
  description: '',
  isActive: true,
  order: 100,
};

/**
 * إدارة فئات الجهات — #D-036
 *
 * على نمط `RequestTypesManager`: تحرير في الصفحة نفسها لأن النموذج صغير.
 * الحذف متاح للفئة الفارغة فقط؛ الخادم يرفض غير ذلك برسالة تقترح التعطيل.
 */
export function CategoriesManager({ rows }: { rows: readonly CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [pending, setPending] = React.useState(false);
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  function openNew() {
    reset();
    setEditing({ ...EMPTY, order: (rows.length + 1) * 10 });
  }

  function openEdit(row: CategoryRow) {
    reset();
    setEditing({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      isActive: row.isActive,
      order: row.order,
    });
  }

  async function save() {
    if (!editing) return;
    reset();
    setPending(true);

    const { id, ...draft } = editing;
    const payload = { ...draft, order: Number(draft.order) || 0 };

    try {
      if (id) {
        await api.patch(`/api/admin/categories/${id}`, payload);
      } else {
        await api.post('/api/admin/categories', payload);
      }

      toast.success('تم حفظ الفئة');
      setEditing(null);
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
    } finally {
      setPending(false);
    }
  }

  async function remove(row: CategoryRow) {
    if (!window.confirm(`حذف فئة «${row.name}» نهائياً؟`)) return;

    try {
      await api.delete(`/api/admin/categories/${row.id}`);
      toast.success('تم حذف الفئة');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحذف.');
    }
  }

  const columns: Array<Column<CategoryRow>> = [
    {
      key: 'name',
      header: 'الفئة',
      searchText: (row) => `${row.name} ${row.slug} ${row.description}`,
      cell: (row) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="block max-w-md truncate text-start font-medium hover:text-primary hover:underline"
          >
            {row.name}
          </button>
          <code className="mt-0.5 block text-xs text-subtle-foreground" dir="ltr">
            {row.slug}
          </code>
        </div>
      ),
    },
    {
      key: 'departments',
      header: 'الجهات',
      className: 'tabular',
      cell: (row) => row.departmentCount,
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
          <button
            type="button"
            onClick={() => openEdit(row)}
            aria-label={`تعديل ${row.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void remove(row)}
            aria-label={`حذف ${row.name}`}
            disabled={row.departmentCount > 0}
            title={row.departmentCount > 0 ? 'فئة غير فارغة — عطّلها بدل حذفها' : undefined}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-subtle hover:text-danger disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {editing ? (
        <div className="mb-6">
          <FormSection
            title={editing.id ? 'تعديل الفئة' : 'فئة جديدة'}
            description="الفئة المعطّلة تُخفي جهاتها من خيارات المستخدمين دون حذف أي شيء."
          >
            <FormError message={formError} />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField id="cat-name" label="الاسم" error={fieldErrors.name} required>
                {(props) => (
                  <Input
                    {...props}
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    placeholder="جهات حكومية"
                  />
                )}
              </FormField>

              <FormField id="cat-slug" label="المعرّف" error={fieldErrors.slug} required>
                {(props) => (
                  <Input
                    {...props}
                    value={editing.slug}
                    onChange={(event) => setEditing({ ...editing, slug: event.target.value })}
                    placeholder="government"
                    dir="ltr"
                    className="text-start"
                  />
                )}
              </FormField>

              <FormField
                id="cat-description"
                label="الوصف"
                error={fieldErrors.description}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    value={editing.description}
                    onChange={(event) =>
                      setEditing({ ...editing, description: event.target.value })
                    }
                  />
                )}
              </FormField>

              <FormField id="cat-order" label="الترتيب" error={fieldErrors.order}>
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    value={String(editing.order)}
                    onChange={(event) =>
                      setEditing({ ...editing, order: Number(event.target.value) })
                    }
                  />
                )}
              </FormField>

              <div className="flex items-end pb-1">
                <Toggle
                  checked={editing.isActive}
                  onChange={(next) => setEditing({ ...editing, isActive: next })}
                  label="مُفعّلة"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Button onClick={() => void save()} loading={pending}>
                {editing.id ? 'حفظ التعديلات' : 'إنشاء'}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                <X className="size-4" />
                إلغاء
              </Button>
            </div>
          </FormSection>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="ابحث في الفئات…"
        emptyTitle="لا توجد فئات"
        emptyDescription="أنشئ فئة قبل إضافة الجهات — كل جهة تنتمي إلى فئة."
        emptyAction={
          <Button onClick={openNew}>
            <FolderTree className="size-4.5" />
            فئة جديدة
          </Button>
        }
        toolbar={
          editing ? undefined : (
            <Button onClick={openNew}>
              <Plus className="size-4.5" />
              فئة جديدة
            </Button>
          )
        }
      />
    </div>
  );
}
