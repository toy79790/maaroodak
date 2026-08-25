import type { Metadata } from 'next';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { AI_DISCLAIMER_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = {
  title: 'إخلاء مسؤولية الذكاء الاصطناعي',
  alternates: { canonical: '/ai-disclaimer' },
};

export default function AiDisclaimerPage() {
  return (
    <LegalPage
      title="إخلاء مسؤولية الذكاء الاصطناعي"
      intro="ما يفعله الذكاء الاصطناعي في هذه المنصة، وما يُمنع من فعله، وما يبقى مسؤوليتك."
      sections={AI_DISCLAIMER_SECTIONS}
    />
  );
}
