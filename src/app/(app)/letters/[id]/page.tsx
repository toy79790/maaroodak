import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getLetter } from '@/features/letters/service';
import { LetterWorkspace } from '@/features/letters/components/letter-workspace';
import { scan } from '@/services/ai/guardrails';
import { htmlToText } from '@/features/letters/html';
import { isAIConfigured } from '@/config/env';
import type { QualityReport } from '@/services/ai/schemas';
import type { AnswerMap } from '@/types/questions';

export const metadata: Metadata = { title: 'المعروض' };

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireUser();
  const { id } = await params;

  const result = await getLetter(user.id, id);
  if (!result.ok) notFound();

  const letter = result.data;

  /*
   * إعادة فحص الضوابط عند كل عرض لا الاكتفاء بالمخزَّن وقت التوليد:
   * المستخدم قد يكون عدّل النص يدوياً أو طبّق أداة، فالتحذيرات يجب أن
   * تعكس النص الحالي لا نص التوليد الأول. الفحص نقي ومجاني.
   */
  const answers = (letter.answers ?? {}) as AnswerMap;
  const facts = Object.values(answers).map((value) =>
    Array.isArray(value) ? value.join(' ') : String(value ?? ''),
  );

  const guardrails = scan({ output: htmlToText(letter.contentHtml), facts });

  return (
    <div className="mx-auto max-w-5xl">
      <LetterWorkspace
        letter={{
          id: letter.id,
          title: letter.title,
          subject: letter.subject,
          contentHtml: letter.contentHtml,
          status: letter.status,
          isFavorite: letter.isFavorite,
          currentVersion: letter.currentVersion,
          qualityReport: (letter.qualityReport as QualityReport | null) ?? null,
          department: { name: letter.department.name },
          requestType: { name: letter.requestType.name },
        }}
        guardrails={guardrails.violations.map((violation) => ({
          kind: violation.kind,
          severity: violation.severity,
          message: violation.message,
          evidence: violation.evidence,
        }))}
        placeholders={guardrails.placeholders}
        creditBalance={user.creditBalance}
        aiEnabled={isAIConfigured}
      />
    </div>
  );
}
