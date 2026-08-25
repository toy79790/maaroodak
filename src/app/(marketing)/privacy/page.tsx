import type { Metadata } from 'next';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { PRIVACY_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = {
  title: 'سياسة الخصوصية',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="سياسة الخصوصية"
      intro="بياناتك ملكك. هذه الصفحة تشرح بالضبط ما نجمعه، ولماذا، وما الذي لا نجمعه."
      sections={PRIVACY_SECTIONS}
    />
  );
}
