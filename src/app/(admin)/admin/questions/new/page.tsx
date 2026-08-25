import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { QuestionBuilder } from '@/features/admin/components/question-builder';
import {
  EMPTY_QUESTION,
  loadQuestionPageData,
} from '@/features/admin/question-page-data';
import { PageHeader } from '@/components/shared/states';

export const metadata: Metadata = { title: 'سؤال جديد' };

export default async function NewQuestionPage() {
  await requirePermission('question:manage');
  const data = await loadQuestionPageData();

  return (
    <>
      <PageHeader
        title="سؤال جديد"
        description="حدّد نطاق السؤال وقواعده الشرطية. التغيير يسري فوراً بلا نشر."
      />
      <QuestionBuilder
        initial={EMPTY_QUESTION}
        departments={data.departments}
        requestTypes={data.requestTypes}
        availableKeys={data.availableKeys}
      />
    </>
  );
}
