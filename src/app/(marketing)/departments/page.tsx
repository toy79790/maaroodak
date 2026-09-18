import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { JsonLd } from '@/components/shared/json-ld';
import { PageIntro } from '@/features/marketing/components/page-intro';
import { listPublicDepartments } from '@/lib/db/repositories/catalog-repository';
import { site } from '@/config/site';

export const metadata: Metadata = pageMetadata({
  title: 'الجهات المدعومة',
  description:
    'الجهات الحكومية والخدمية والتعليمية والخاصة التي يمكنك كتابة معروض إليها، وأنواع الطلبات المتاحة لكل جهة.',
  path: '/departments',
});

/**
 * من القاعدة لحظياً لا من محتوى ثابت: ما يضيفه المسؤول أو يعطّله يظهر هنا
 * فوراً. ولا تُولَّد وقت البناء — البناء في CI يجري بلا قاعدة بيانات.
 */
export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const categories = await listPublicDepartments();
  const total = categories.reduce((sum, category) => sum + category.departments.length, 0);

  return (
    <PageIntro
      wide
      title="الجهات المدعومة"
      intro={`${total} جهة، لكل منها صيغة مخاطبة وأسئلة تناسب اختصاصها. وإن لم تجد جهتك، اختر «جهة أخرى» عند البدء.`}
    >
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `الجهات المدعومة في ${site.name}`,
          numberOfItems: total,
          itemListElement: categories
            .flatMap((category) => category.departments)
            .map((department, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: department.name,
            })),
        }}
      />

      <div className="space-y-12">
        {categories.map((category) => (
          <section key={category.slug} aria-labelledby={`cat-${category.slug}`}>
            <div className="mb-5 flex items-center gap-3">
              <h2 id={`cat-${category.slug}`} className="text-xl font-bold">
                {category.name}
              </h2>
              <Badge tone="neutral" className="tabular">
                {category.departments.length}
              </Badge>
            </div>
            {category.description ? (
              <p className="-mt-3 mb-5 text-sm text-muted-foreground">{category.description}</p>
            ) : null}

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.departments.map((department) => (
                <li key={department.slug}>
                  <Card className="h-full p-5 surface-flat">
                    <h3 className="font-semibold">{department.name}</h3>
                    {department.description ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {department.description}
                      </p>
                    ) : null}
                    {department.requestTypes.length > 0 ? (
                      <p className="mt-3 text-xs leading-relaxed text-subtle-foreground">
                        {department.requestTypes.join(' · ')}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <Button asChild>
          <Link href="/new">ابدأ كتابة معروضك</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/request-types">أنواع المعاريض</Link>
        </Button>
      </div>
    </PageIntro>
  );
}
