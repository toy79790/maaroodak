import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getInterview } from '@/features/interview/service';
import { InterviewWizard } from '@/features/interview/components/interview-wizard';

export const metadata: Metadata = { title: 'إنشاء معروض' };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { user } = await requireUser();
  const { sessionId } = await params;

  const result = await getInterview(
    user.id,
    { organizationId: user.organizationId },
    sessionId,
  );

  if (!result.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <InterviewWizard initial={result.data} />
    </div>
  );
}
