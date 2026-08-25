import type { Metadata } from 'next';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { TERMS_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = {
  title: 'شروط الاستخدام',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="شروط الاستخدام"
      intro="ما تلتزم به، وما نلتزم به، وحدود مسؤولية كل طرف."
      sections={TERMS_SECTIONS}
    />
  );
}
