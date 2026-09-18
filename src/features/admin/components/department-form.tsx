'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Check } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { FormError, FormField } from '@/components/shared/form-field';
import {
  FormActions,
  FormSection,
  Toggle,
  adminSelectClass,
  useFormErrors,
} from '@/features/admin/components/admin-form';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { searchKey } from '@/lib/utils/arabic';

export interface DepartmentFormValue {
  slug: string;
  name: string;
  nameEn: string;
  categoryId: string;
  description: string;
  honorific: string;
  addressee: string;
  order: number;
  isActive: boolean;
  requestTypeIds: string[];
}

export const EMPTY_DEPARTMENT: DepartmentFormValue = {
  slug: '',
  name: '',
  nameEn: '',
  categoryId: '',
  description: '',
  honorific: 'سعادة',
  addressee: '',
  order: 100,
  isActive: true,
  requestTypeIds: [],
};

export function DepartmentForm({
  initial,
  departmentId,
  requestTypes,
  categories,
}: {
  initial: DepartmentFormValue;
  departmentId?: string;
  requestTypes: ReadonlyArray<{ id: string; name: string }>;
  /** الفئات من القاعدة — تُدار من /admin/categories. */
  categories: ReadonlyArray<{ id: string; name: string; isActive: boolean }>;
}) {
  const router = useRouter();
  // جهة جديدة بلا فئة: أول فئة مُفعّلة افتراضياً بدل قائمة فارغة الاختيار.
  const [value, setValue] = React.useState(() => ({
    ...initial,
    categoryId:
      initial.categoryId || (categories.find((c) => c.isActive) ?? categories[0])?.id || '',
  }));
  const [pending, setPending] = React.useState(false);
  const [typeQuery, setTypeQuery] = React.useState('');
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  const set = <K extends keyof DepartmentFormValue>(
    key: K,
    next: DepartmentFormValue[K],
  ) => setValue((current) => ({ ...current, [key]: next }));

  const filteredTypes = React.useMemo(() => {
    const needle = searchKey(typeQuery.trim());
    if (!needle) return requestTypes;
    return requestTypes.filter((type) => searchKey(type.name).includes(needle));
  }, [requestTypes, typeQuery]);

  function toggleType(id: string) {
    set(
      'requestTypeIds',
      value.requestTypeIds.includes(id)
        ? value.requestTypeIds.filter((item) => item !== id)
        : [...value.requestTypeIds, id],
    );
  }

  async function save() {
    reset();
    setPending(true);

    const payload = { ...value, order: Number(value.order) || 0 };

    try {
      if (departmentId) {
        await api.patch(`/api/admin/departments/${departmentId}`, payload);
      } else {
        await api.post('/api/admin/departments', payload);
      }

      toast.success('تم حفظ الجهة');
      router.push('/admin/departments');
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormError message={formError} />

      <FormSection title="بيانات الجهة">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="d-name"
            label="اسم الجهة"
            error={fieldErrors.name}
            required
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={value.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="وزارة الموارد البشرية والتنمية الاجتماعية"
              />
            )}
          </FormField>

          <FormField
            id="d-slug"
            label="المعرّف"
            description="يُستخدم في الروابط. لا يُغيَّر بعد النشر."
            error={fieldErrors.slug}
            required
          >
            {(props) => (
              <Input
                {...props}
                value={value.slug}
                onChange={(event) => set('slug', event.target.value)}
                placeholder="ministry-hrsd"
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="d-category" label="الفئة" error={fieldErrors.categoryId} required>
            {(props) => (
              <select
                {...props}
                value={value.categoryId}
                onChange={(event) => set('categoryId', event.target.value)}
                className={adminSelectClass}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.isActive ? category.name : `${category.name} (معطّلة)`}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            id="d-name-en"
            label="الاسم بالإنجليزية"
            error={fieldErrors.nameEn}
          >
            {(props) => (
              <Input
                {...props}
                value={value.nameEn}
                onChange={(event) => set('nameEn', event.target.value)}
                dir="ltr"
                className="text-start"
              />
            )}
          </FormField>

          <FormField id="d-order" label="الترتيب" error={fieldErrors.order}>
            {(props) => (
              <Input
                {...props}
                type="number"
                value={String(value.order)}
                onChange={(event) => set('order', Number(event.target.value))}
              />
            )}
          </FormField>

          <FormField
            id="d-description"
            label="الوصف"
            description="يظهر للمستخدم تحت اسم الجهة عند الاختيار."
            error={fieldErrors.description}
            className="sm:col-span-2"
          >
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={value.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="الضمان الاجتماعي، الدعم، العمل، وحقوق العمال."
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="صيغة المخاطبة"
        description="هذه الحقول تدخل مباشرة في ترويسة المعروض وفي سياق الذكاء الاصطناعي — وهي ما يجعل مخاطبة الديوان الملكي تختلف عن مخاطبة شركة اتصالات."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="d-honorific"
            label="اللقب"
            description="معالي · سعادة · صاحب السمو الملكي"
            error={fieldErrors.honorific}
          >
            {(props) => (
              <Input
                {...props}
                value={value.honorific}
                onChange={(event) => set('honorific', event.target.value)}
                placeholder="معالي"
              />
            )}
          </FormField>

          <FormField
            id="d-addressee"
            label="سطر المخاطبة"
            description="كما سيظهر أعلى المعروض."
            error={fieldErrors.addressee}
          >
            {(props) => (
              <Input
                {...props}
                value={value.addressee}
                onChange={(event) => set('addressee', event.target.value)}
                placeholder="معالي وزير الموارد البشرية والتنمية الاجتماعية"
              />
            )}
          </FormField>
        </div>

        {value.addressee ? (
          <div className="mt-4 rounded-[var(--radius-field)] border border-border bg-surface-muted/50 p-4">
            <p className="mb-2 text-xs text-muted-foreground">معاينة الترويسة:</p>
            <p className="text-center [font-family:var(--font-letter)]">
              بسم الله الرحمن الرحيم
            </p>
            <p className="mt-3 [font-family:var(--font-letter)]">{value.addressee}</p>
            <p className="[font-family:var(--font-letter)]">حفظه الله</p>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="أنواع الطلبات المتاحة"
        description="ما تختاره هنا هو ما سيراه المستخدم بعد اختيار هذه الجهة. اختيار كل الأنواع لكل جهة يُضعف التجربة — اختر ما يخصّ اختصاصها فعلاً."
      >
        <Input
          type="search"
          value={typeQuery}
          onChange={(event) => setTypeQuery(event.target.value)}
          placeholder="ابحث في أنواع الطلبات…"
          aria-label="ابحث في أنواع الطلبات"
          className="mb-3"
        />

        <p className="mb-3 text-xs text-muted-foreground">
          مختار: {value.requestTypeIds.length} من {requestTypes.length}
        </p>

        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {filteredTypes.map((type) => {
            const selected = value.requestTypeIds.includes(type.id);

            return (
              <label
                key={type.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-field)] border p-3 text-sm transition-colors',
                  selected
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border hover:border-border-strong hover:bg-surface-muted/60',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleType(type.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    'flex size-4.5 shrink-0 items-center justify-center rounded border-2',
                    selected ? 'border-primary bg-primary text-white' : 'border-sand-400',
                  )}
                >
                  {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 truncate">{type.name}</span>
              </label>
            );
          })}
        </div>

        {fieldErrors.requestTypeIds ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {fieldErrors.requestTypeIds}
          </p>
        ) : null}
      </FormSection>

      <FormSection title="الحالة">
        <Toggle
          checked={value.isActive}
          onChange={(next) => set('isActive', next)}
          label="الجهة مُفعّلة"
          description="الجهة المعطّلة تختفي من خيارات المستخدمين ولا تتأثر معاريضهم السابقة."
        />
      </FormSection>

      <FormActions
        onSave={() => void save()}
        pending={pending}
        saveLabel={departmentId ? 'حفظ التعديلات' : 'إنشاء الجهة'}
        cancelHref="/admin/departments"
        extra={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className="size-3.5" aria-hidden />
            التغيير يسري فوراً
          </span>
        }
      />
    </div>
  );
}
