import type { Metadata } from 'next';
import { Hero } from '@/features/marketing/components/hero';
import {
  ExampleSection,
  Faq,
  Features,
  FinalCta,
  HowItWorks,
  Pricing,
  SupportedDepartments,
} from '@/features/marketing/components/sections';
import { FAQ_ITEMS } from '@/features/marketing/content';
import { site } from '@/config/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** بيانات منظّمة — تُحسّن ظهور الأسئلة الشائعة في نتائج البحث. */
function StructuredData() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: site.name,
      url: site.url,
      applicationCategory: 'BusinessApplication',
      inLanguage: 'ar',
      description: site.description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SAR',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // محتوى ثابت من الخادم، لا مدخلات مستخدم.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Hero />
      <HowItWorks />
      <Features />
      <SupportedDepartments />
      <ExampleSection />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}
