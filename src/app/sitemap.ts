import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

/**
 * خريطة الموقع — الصفحات العامة القابلة للفهرسة فقط.
 * كل مسار هنا يجب أن يحمل `alternates.canonical` مطابقاً في صفحته.
 */
const PAGES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/departments', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/request-types', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/register', priority: 0.6 },
  { path: '/login', priority: 0.3 },
  { path: '/ai-disclaimer', priority: 0.4 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return PAGES.map((page) => ({
    url: `${site.url}${page.path}`,
    lastModified: now,
    priority: page.priority,
    ...(page.changeFrequency ? { changeFrequency: page.changeFrequency } : {}),
  }));
}
