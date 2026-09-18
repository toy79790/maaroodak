import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { AI_DISCLAIMER_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = pageMetadata({
  title: 'إخلاء مسؤولية الذكاء الاصطناعي',
  description: 'كيف يعمل الذكاء الاصطناعي في المنصة، وما الذي يُمنع من فعله، وما الذي نفحصه قبل عرض المعروض عليك.',
  path: '/ai-disclaimer',
});

export default function AiDisclaimerPage() {
  return (
    <LegalPage
      title="إخلاء مسؤولية الذكاء الاصطناعي"
      intro="ما يفعله الذكاء الاصطناعي في هذه المنصة، وما يُمنع من فعله، وما يبقى مسؤوليتك."
      sections={AI_DISCLAIMER_SECTIONS}
    />
  );
}
