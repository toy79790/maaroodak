import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // مساحات المستخدم والإدارة لا تُفهرس — لا قيمة بحثية ومخاطرة خصوصية.
      disallow: ['/api/', '/dashboard', '/letters', '/new', '/admin', '/settings', '/credits', '/favorites'],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
