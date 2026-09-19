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
import { JsonLd } from '@/components/shared/json-ld';
import { site } from '@/config/site';
import { PRICE_PER_LETTER_SAR } from '@/config/constants';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * بيانات منظّمة للرئيسية. `FAQPage` انتقل إلى /faq: Google يعتمد ترميز
 * الأسئلة الشائعة من صفحة واحدة، وتكراره في صفحتين يُضعفه لا يقوّيه.
 */
const STRUCTURED_DATA = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    alternateName: site.nameEn,
    url: site.url,
    inLanguage: 'ar',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: site.name,
    url: site.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'ar',
    description: site.description,
    offers: {
      '@type': 'Offer',
      price: String(PRICE_PER_LETTER_SAR),
      priceCurrency: 'SAR',
      description: 'للمعروض الواحد، شامل ضريبة القيمة المضافة',
    },
  },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={STRUCTURED_DATA} />
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
