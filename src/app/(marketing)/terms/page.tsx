import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { TERMS_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = pageMetadata({
  title: 'شروط الاستخدام',
  description: 'طبيعة الخدمة، ومسؤوليتك عن المحتوى، والرصيد، وحدود المسؤولية.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      title="شروط الاستخدام"
      intro="ما تلتزم به، وما نلتزم به، وحدود مسؤولية كل طرف."
      sections={TERMS_SECTIONS}
    />
  );
}
