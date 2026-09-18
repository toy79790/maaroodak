import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageIntro } from '@/features/marketing/components/page-intro';
import { listPublicRequestTypes } from '@/lib/db/repositories/catalog-repository';

export const metadata: Metadata = pageMetadata({
  title: 'أنواع المعاريض',
  description:
    'أنواع الطلبات التي تساعدك المنصة على كتابتها: طلب مساعدة، سداد مديونية، إعفاء، علاج، شكوى، تظلم، اعتراض، وغيرها.',
  path: '/request-types',
});

/** لحظياً من القاعدة — انظر التعليق في /departments. */
export const dynamic = 'force-dynamic';

export default async function RequestTypesPage() {
  const types = await listPublicRequestTypes();

  return (
    <PageIntro
      wide
      title="أنواع المعاريض"
      intro="الأنواع المتاحة تختلف من جهة لأخرى: بعد اختيار الجهة لا تظهر لك إلا الأنواع التي تخصّ اختصاصها."
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((type) => (
          <li key={type.slug}>
            <Card className="h-full p-5 surface-flat">
              <h2 className="font-semibold">{type.name}</h2>
              {type.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {type.description}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-subtle-foreground">
                متاح لدى <span className="tabular">{type.departmentCount}</span>{' '}
                {type.departmentCount === 1 ? 'جهة' : 'جهات'}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
        <Button asChild>
          <Link href="/new">ابدأ كتابة معروضك</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/departments">الجهات المدعومة</Link>
        </Button>
      </div>
    </PageIntro>
  );
}
