import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import { LegalPage } from '@/features/marketing/components/legal-page';
import { PRIVACY_SECTIONS } from '@/features/marketing/legal-content';

export const metadata: Metadata = pageMetadata({
  title: 'سياسة الخصوصية',
  description: 'ما البيانات التي نجمعها، ولماذا، وما الذي لا نسجّله، وكيف تحذف بياناتك متى شئت.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="سياسة الخصوصية"
      intro="بياناتك ملكك. هذه الصفحة تشرح بالضبط ما نجمعه، ولماذا، وما الذي لا نجمعه."
      sections={PRIVACY_SECTIONS}
    />
  );
}
