import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, GitBranch } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { listQuestionsAdmin } from '@/features/admin/queries';
import { QuestionsTable } from '@/features/admin/components/questions-table';
import { PageHeader } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'الأسئلة' };

export default async function AdminQuestionsPage() {
  await requirePermission('question:manage');

  const questions = await listQuestionsAdmin();
  const withConditions = questions.filter((q) => q._count.conditions > 0).length;

  return (
    <>
      <PageHeader
        title="الأسئلة"
        description="بنك الأسئلة الذي تُبنى منه كل المقابلات. إضافة سؤال لا تتطلب نشراً."
        actions={
          <Button asChild>
            <Link href="/admin/questions/new">
              <Plus className="size-4.5" />
              سؤال جديد
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-6 p-4">
        <div>
          <p className="text-xs text-muted-foreground">إجمالي الأسئلة</p>
          <p className="tabular text-xl font-bold">{questions.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">أسئلة مشروطة</p>
          <p className="tabular flex items-center gap-1.5 text-xl font-bold">
            <GitBranch className="size-4 text-primary" aria-hidden />
            {withConditions}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">أسئلة عامة</p>
          <p className="tabular text-xl font-bold">
            {questions.filter((q) => !q.department && !q.requestType).length}
          </p>
        </div>
      </Card>

      <QuestionsTable
        rows={questions.map((question) => ({
          id: question.id,
          key: question.key,
          label: question.label,
          type: question.type,
          required: question.required,
          order: question.order,
          isActive: question.isActive,
          departmentName: question.department?.name ?? null,
          requestTypeName: question.requestType?.name ?? null,
          optionCount: question._count.options,
          conditionCount: question._count.conditions,
        }))}
      />
    </>
  );
}
