import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ABOUT_SECTIONS } from '@/features/marketing/content';
import { PageIntro, PendingContent } from '@/features/marketing/components/page-intro';
import { site } from '@/config/site';

export const metadata: Metadata = pageMetadata({
  title: 'من نحن',
  description:
    `تعرّف على ${site.name}: منصة تساعدك على كتابة المعاريض والخطابات الرسمية من إجاباتك أنت، دون اختراع أي معلومة.`,
  path: '/about',
});

export default function AboutPage() {
  return (
    <PageIntro
      title={`عن ${site.name}`}
      intro="نساعدك على أن تقول ما تريد قوله للجهة، بصياغة رسمية واضحة — دون أن نضيف إليه ما لم تقله."
    >
      <div className="space-y-9">
        {ABOUT_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="mt-3 leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section>
          <h2 className="text-lg font-semibold">الجهة المالكة للمنصة</h2>
          <div className="mt-3">
            {/* TODO(محتوى): اسم الكيان النظامي ورقم السجل التجاري والمدينة. */}
            <PendingContent>
              نص مؤقت — تُضاف هنا بيانات الجهة المالكة للمنصة (الاسم النظامي، رقم
              السجل التجاري، المدينة) قبل الإطلاق.
            </PendingContent>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
          <Button asChild>
            <Link href="/new">ابدأ كتابة معروضك</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/contact">تواصل معنا</Link>
          </Button>
        </div>
      </div>
    </PageIntro>
  );
}
