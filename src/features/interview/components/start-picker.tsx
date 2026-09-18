'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/states';
import { api, ApiError } from '@/lib/api/client';
import { searchKey } from '@/lib/utils/arabic';
import { cn } from '@/lib/utils/cn';
import type { InterviewData } from '@/features/interview/components/interview-wizard';

export interface DepartmentOption {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  requestTypeCount: number;
}

interface RequestTypeOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

/**
 * اختيار الجهة ثم نوع الطلب — الخطوتان قبل المقابلة.
 *
 * أنواع الطلبات تُجلب **بعد** اختيار الجهة لا قبله: القائمة تختلف بين
 * الجهات، وعرض كل الأنواع ثم إخفاء غير المتاح يربك المستخدم.
 */
export function StartPicker({
  departments,
}: {
  departments: readonly DepartmentOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<DepartmentOption | null>(null);
  const [requestTypes, setRequestTypes] = React.useState<RequestTypeOption[] | null>(
    null,
  );
  const [loadingTypes, setLoadingTypes] = React.useState(false);
  const [starting, setStarting] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const needle = searchKey(query.trim());
    if (!needle) return departments;
    return departments.filter((department) =>
      searchKey(`${department.name} ${department.description ?? ''}`).includes(
        needle,
      ),
    );
  }, [departments, query]);

  const grouped = React.useMemo(() => {
    const groups = new Map<string, DepartmentOption[]>();
    for (const department of filtered) {
      const list = groups.get(department.category) ?? [];
      list.push(department);
      groups.set(department.category, list);
    }
    return [...groups.entries()];
  }, [filtered]);

  async function selectDepartment(department: DepartmentOption) {
    setSelected(department);
    setRequestTypes(null);
    setLoadingTypes(true);

    try {
      const response = await api.get<RequestTypeOption[]>(
        `/api/departments/${department.id}/request-types`,
      );
      setRequestTypes(response.data);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : 'تعذّر جلب أنواع الطلبات.',
      );
      setSelected(null);
    } finally {
      setLoadingTypes(false);
    }
  }

  async function start(requestType: RequestTypeOption) {
    if (!selected) return;
    setStarting(requestType.id);

    try {
      const response = await api.post<InterviewData>('/api/interview/start', {
        departmentId: selected.id,
        requestTypeId: requestType.id,
      });
      router.push(`/new/${response.data.sessionId}`);
    } catch (error) {
      setStarting(null);
      toast.error(
        error instanceof ApiError ? error.message : 'تعذّر بدء المقابلة.',
      );
    }
  }

  // --- الخطوة 2: نوع الطلب -------------------------------------------------
  if (selected) {
    return (
      <div className="animate-fade-up">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setRequestTypes(null);
          }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-4" aria-hidden />
          تغيير الجهة
        </button>

        <div className="mb-6">
          <Badge tone="brand">{selected.name}</Badge>
          <h1 className="mt-3 text-xl font-bold">ما نوع طلبك؟</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            الخيارات المعروضة هي ما تختص به هذه الجهة.
          </p>
        </div>

        {loadingTypes ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy>
            <span className="sr-only">جارٍ التحميل…</span>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton h-20 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : requestTypes && requestTypes.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {requestTypes.map((requestType) => (
              <button
                key={requestType.id}
                type="button"
                onClick={() => void start(requestType)}
                disabled={starting !== null}
                className={cn(
                  'group flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-start',
                  'transition-colors hover:border-primary hover:bg-primary-subtle/40',
                  'disabled:opacity-60',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{requestType.name}</span>
                  {requestType.description ? (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {requestType.description}
                    </span>
                  ) : null}
                </span>
                {starting === requestType.id ? (
                  <Loader2 className="mt-0.5 size-4.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <ArrowLeft className="mt-0.5 size-4.5 shrink-0 text-subtle-foreground transition-colors group-hover:text-primary" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="لا توجد أنواع طلبات لهذه الجهة"
            description="اختر جهة أخرى، أو تواصل معنا لإضافة نوع الطلب الذي تحتاجه."
            action={
              <Button variant="secondary" onClick={() => setSelected(null)}>
                اختر جهة أخرى
              </Button>
            }
          />
        )}
      </div>
    );
  }

  // --- الخطوة 1: الجهة -----------------------------------------------------
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">ما الجهة التي تريد مخاطبتها؟</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          لكل جهة أسئلتها وصيغة مخاطبتها الخاصة.
        </p>
      </div>

      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4.5 text-subtle-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث عن جهة…"
          aria-label="ابحث عن جهة"
          className="ps-11"
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={Search}
          title="لا توجد نتائج"
          description={`لم نجد جهة تطابق «${query}». جرّب كلمة أخرى، أو اختر «جهة أخرى» من القائمة.`}
          action={
            <Button variant="secondary" onClick={() => setQuery('')}>
              مسح البحث
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                {category}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((department) => (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() => void selectDepartment(department)}
                    className="group flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-start transition-colors hover:border-primary hover:bg-primary-subtle/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{department.name}</span>
                      {department.description ? (
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {department.description}
                        </span>
                      ) : null}
                    </span>
                    <ArrowLeft className="mt-0.5 size-4.5 shrink-0 text-subtle-foreground transition-colors group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
