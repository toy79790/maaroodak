import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { JsonLd } from '@/components/shared/json-ld';
import { FaqList } from '@/features/marketing/components/sections';
import { PageIntro } from '@/features/marketing/components/page-intro';
import { FAQ_ITEMS } from '@/features/marketing/content';

export const metadata: Metadata = pageMetadata({
  title: 'الأسئلة الشائعة',
  description:
    'إجابات عن أكثر الأسئلة تكراراً: هل المعروض جاهز للتقديم؟ هل يخترع الذكاء الاصطناعي معلومات؟ ما مصير بياناتي؟',
  path: '/faq',
});

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

export default function FaqPage() {
  return (
    <PageIntro
      title="الأسئلة الشائعة"
      intro="إن لم تجد سؤالك هنا، راسلنا وسنجيبك."
    >
      <JsonLd data={FAQ_SCHEMA} />
      <FaqList />
      <p className="mt-10 text-sm text-muted-foreground">
        لديك سؤال آخر؟{' '}
        <Link href="/contact" className="text-primary hover:underline">
          تواصل معنا
        </Link>
      </p>
    </PageIntro>
  );
}
