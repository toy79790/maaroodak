import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { listPromptsAdmin } from '@/features/admin/queries';
import { PromptsTable } from '@/features/admin/components/prompts-table';
import { PageHeader } from '@/components/shared/states';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'موجّهات الذكاء الاصطناعي' };

export default async function AdminPromptsPage() {
  await requirePermission('prompt:manage');
  const prompts = await listPromptsAdmin();

  return (
    <>
      <PageHeader
        title="موجّهات الذكاء الاصطناعي"
        description="تعديل صياغة المخرجات بلا نشر. جرّب أي موجّه قبل حفظه."
        actions={
          <Button asChild>
            <Link href="/admin/prompts/new">
              <Plus className="size-4.5" />
              موجّه جديد
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-field)] border border-info/30 bg-info-subtle px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-info" aria-hidden />
        <p className="text-sm leading-relaxed text-info">
          قواعد منع الاختراع (الطبقة L1) مثبّتة في الشيفرة ولا تظهر هنا — لا يمكن
          تعطيلها من لوحة التحكم بأي حال.
        </p>
      </div>

      <PromptsTable
        rows={prompts.map((prompt) => ({
          id: prompt.id,
          key: prompt.key,
          name: prompt.name,
          type: prompt.type,
          isActive: prompt.isActive,
          model: prompt.model,
          departmentName: prompt.department?.name ?? null,
          requestTypeName: prompt.requestType?.name ?? null,
          updatedAt: prompt.updatedAt.toISOString(),
        }))}
      />
    </>
  );
}
