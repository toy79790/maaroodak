import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getInterview } from '@/features/interview/service';
import { InterviewWizard } from '@/features/interview/components/interview-wizard';
import { getSettings } from '@/lib/db/repositories/settings-repository';

export const metadata: Metadata = { title: 'إنشاء معروض' };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { user } = await requireUser();
  const { sessionId } = await params;

  const [result, settings] = await Promise.all([
    getInterview(user.id, { organizationId: user.organizationId }, sessionId),
    getSettings(),
  ]);

  if (!result.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <InterviewWizard
        initial={result.data}
        lacksCredits={user.creditBalance < settings.creditCosts.GENERATE_LETTER}
      />
    </div>
  );
}
