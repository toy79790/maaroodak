import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { QuestionBuilder } from '@/features/admin/components/question-builder';
import {
  loadQuestionForEdit,
  loadQuestionPageData,
} from '@/features/admin/question-page-data';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'تعديل السؤال' };

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('question:manage');
  const { id } = await params;

  const [question, data] = await Promise.all([
    loadQuestionForEdit(id),
    loadQuestionPageData(),
  ]);

  if (!question) notFound();

  return (
    <>
      <PageHeader
        title="تعديل السؤال"
        description={`المفتاح: ${question.key}`}
      />
      <QuestionBuilder
        initial={question}
        questionId={id}
        departments={data.departments}
        requestTypes={data.requestTypes}
        availableKeys={data.availableKeys.filter((item) => item.key !== question.key)}
      />
    </>
  );
}
