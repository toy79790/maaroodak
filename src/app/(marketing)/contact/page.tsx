import type { Metadata } from 'next';
import { pageMetadata } from '@/config/seo';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageIntro, PendingContent } from '@/features/marketing/components/page-intro';
import { site } from '@/config/site';

export const metadata: Metadata = pageMetadata({
  title: 'تواصل معنا',
  description:
    `للاستفسارات والدعم الفني وطلبات البيانات الشخصية في ${site.name}.`,
  path: '/contact',
});

export default function ContactPage() {
  return (
    <PageIntro
      title="تواصل معنا"
      intro="للاستفسار عن المنصة، أو الإبلاغ عن مشكلة، أو طلب نسخة من بياناتك أو حذفها."
    >
      <div className="space-y-6">
        <Card className="flex items-start gap-4 p-6 surface-flat">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Mail className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">البريد الإلكتروني</h2>
            <a
              href={`mailto:${site.supportEmail}`}
              dir="ltr"
              className="mt-1 inline-block break-all text-primary hover:underline"
            >
              {site.supportEmail}
            </a>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              لا تُرسل في رسالتك رقم هويتك أو كلمة مرورك — لن نطلبهما منك أبداً.
            </p>
          </div>
        </Card>

        {/* TODO(محتوى): مدة الرد المعتمدة، وأي قناة تواصل إضافية. */}
        <PendingContent>
          نص مؤقت — تُضاف هنا مدة الرد المعتمدة وأي قنوات تواصل أخرى (هاتف، حسابات
          رسمية) بعد اعتمادها.
        </PendingContent>

        <p className="text-sm leading-relaxed text-muted-foreground">
          قبل أن تراسلنا، قد تجد إجابتك في{' '}
          <Link href="/faq" className="text-primary hover:underline">
            الأسئلة الشائعة
          </Link>
          .
        </p>
      </div>
    </PageIntro>
  );
}
