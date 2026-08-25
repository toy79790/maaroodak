'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, X, ListTree } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormError, FormField } from '@/components/shared/form-field';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { FormSection, Toggle, useFormErrors } from '@/features/admin/components/admin-form';
import { api, ApiError } from '@/lib/api/client';

export interface RequestTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  order: number;
  departmentCount: number;
  questionCount: number;
}

const EMPTY: Omit<RequestTypeRow, 'id' | 'departmentCount' | 'questionCount'> = {
  slug: '',
  name: '',
  description: '',
  icon: '',
  isActive: true,
  order: 100,
};

/**
 * إدارة أنواع الطلبات.
 *
 * التحرير في نفس الصفحة لا في صفحة منفصلة: النموذج خمسة حقول بسيطة،
 * والانتقال بين صفحتين لتعديل حقل واحد احتكاك بلا مقابل.
 */
export function RequestTypesManager({ rows }: { rows: readonly RequestTypeRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<
    (typeof EMPTY & { id?: string }) | null
  >(null);
  const [pending, setPending] = React.useState(false);
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  function openNew() {
    reset();
    setEditing({ ...EMPTY, order: (rows.length + 1) * 10 });
  }

  function openEdit(row: RequestTypeRow) {
    reset();
    setEditing({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: row.icon,
      isActive: row.isActive,
      order: row.order,
    });
  }

  async function save() {
    if (!editing) return;
    reset();
    setPending(true);

    const { id, ...payload } = editing;

    try {
      if (id) {
        await api.patch(`/api/admin/request-types/${id}`, {
          ...payload,
          order: Number(payload.order) || 0,
        });
      } else {
        await api.post('/api/admin/request-types', {
          ...payload,
          order: Number(payload.order) || 0,
        });
      }

      toast.success('تم حفظ نوع الطلب');
      setEditing(null);
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
    } finally {
      setPending(false);
    }
  }

  const columns: Array<Column<RequestTypeRow>> = [
    {
      key: 'name',
      header: 'نوع الطلب',
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
      key: 'questions',
      header: 'الأسئلة',
      className: 'tabular',
      cell: (row) => row.questionCount,
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
      key: 'order',
      header: 'الترتيب',
      className: 'tabular w-20',
      cell: (row) => row.order,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      cell: (row) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => openEdit(row)}
            aria-label={`تعديل ${row.name}`}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
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
            title={editing.id ? 'تعديل نوع الطلب' : 'نوع طلب جديد'}
            description="لا يظهر النوع للمستخدم إلا بعد ربطه بجهة من شاشة الجهات."
          >
            <FormError message={formError} />

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField id="rt-name" label="الاسم" error={fieldErrors.name} required>
                {(props) => (
                  <Input
                    {...props}
                    value={editing.name}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                    placeholder="طلب سداد مديونية"
                  />
                )}
              </FormField>

              <FormField id="rt-slug" label="المعرّف" error={fieldErrors.slug} required>
                {(props) => (
                  <Input
                    {...props}
                    value={editing.slug}
                    onChange={(event) =>
                      setEditing({ ...editing, slug: event.target.value })
                    }
                    placeholder="debt-settlement"
                    dir="ltr"
                    className="text-start"
                  />
                )}
              </FormField>

              <FormField
                id="rt-description"
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
                    placeholder="طلب سداد أو جدولة دين مستحق."
                  />
                )}
              </FormField>

              <FormField id="rt-order" label="الترتيب" error={fieldErrors.order}>
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
                  label="مُفعّل"
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
        searchPlaceholder="ابحث في أنواع الطلبات…"
        emptyTitle="لا توجد أنواع طلبات"
        emptyDescription="أضف أول نوع طلب ثم اربطه بالجهات المناسبة."
        emptyAction={
          <Button onClick={openNew}>
            <ListTree className="size-4.5" />
            نوع جديد
          </Button>
        }
        toolbar={
          editing ? undefined : (
            <Button onClick={openNew}>
              <Plus className="size-4.5" />
              نوع جديد
            </Button>
          )
        }
      />
    </div>
  );
}
