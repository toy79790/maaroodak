import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section, SectionHeading } from '@/components/shared/section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DEPARTMENT_GROUPS,
  FAQ_ITEMS,
  FEATURES,
  PRICING_PLANS,
  REQUEST_TYPE_CHIPS,
  STEPS,
} from '@/features/marketing/content';
import { AI_DISCLAIMER_SHORT } from '@/config/site';
import { cn } from '@/lib/utils/cn';

/* -------------------------------------------------------------------------- */

export function HowItWorks() {
  return (
    <Section id="how-it-works" muted>
      <SectionHeading
        title="أربع خطوات من الفكرة إلى خطاب جاهز"
        description="لا تبدأ من صفحة بيضاء. نحن نسألك، وأنت تجيب."
      />

      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li key={step.number}>
            <Card className="h-full p-6 surface-flat">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.number}
                </span>
                <step.icon className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function Features() {
  return (
    <Section id="features">
      <SectionHeading
        title="ليست أداة كتابة عامة"
        description="الفرق ليس في الصياغة — بل في معرفة ما يجب أن يُقال لكل جهة، وما لا يجوز اختراعه."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="p-6 surface-flat">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <feature.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function SupportedDepartments() {
  return (
    <Section id="departments" muted>
      <SectionHeading
        title="جهات حكومية وخدمية وتعليمية وخاصة"
        description="لكل جهة أسئلتها وصيغة مخاطبتها وقالبها. وإن لم تجد جهتك، اختر «جهة أخرى»."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {DEPARTMENT_GROUPS.map((group) => (
          <Card key={group.category} className="p-6 surface-flat">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                <group.icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="font-semibold">{group.category}</h3>
              <Badge tone="neutral" className="ms-auto tabular">
                {group.items.length}
              </Badge>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <h3 className="text-center text-sm font-semibold text-muted-foreground">
          وأنواع الطلبات المدعومة
        </h3>
        <ul className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2">
          {REQUEST_TYPE_CHIPS.map((type) => (
            <li
              key={type}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground"
            >
              {type}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

const EXAMPLE_LETTER = {
  department: 'وزارة الموارد البشرية والتنمية الاجتماعية',
  requestType: 'طلب مساعدة مالية',
  subject: 'طلب مساعدة مالية عاجلة',
  body: [
    'أتقدم إلى سعادتكم بهذا المعروض راجياً من الله ثم منكم النظر في طلبي، وأنا مواطن أعول أسرة مكوّنة من ستة أفراد، وأقيم في مدينة الرياض.',
    'انقطع دخلي منذ ستة أشهر بعد إنهاء خدماتي من جهة عملي، ولم أتمكن حتى تاريخه من إيجاد عمل بديل، وترتّب على ذلك تراكم إيجار السكن والتزامات أساسية لأسرتي.',
    'وعليه ألتمس من سعادتكم التكرم بالنظر في صرف مساعدة مالية عاجلة تعينني على تجاوز هذه المرحلة، ودراسة إمكانية إدراجي ضمن المستفيدين من برامج الدعم لدى الوزارة.',
  ],
};

export function ExampleSection() {
  return (
    <Section id="examples">
      <SectionHeading
        title="هكذا يبدو معروضك"
        description="مثال توضيحي لمخرجات المنصة — الصياغة تتغيّر بالكامل حسب الجهة ونوع الطلب وإجاباتك."
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="brand">{EXAMPLE_LETTER.department}</Badge>
          <Badge tone="neutral">{EXAMPLE_LETTER.requestType}</Badge>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-lift">
          <div className="px-8 py-10 text-right leading-loose text-[#111] [font-family:var(--font-letter)] sm:px-14 sm:py-12">
            <p className="text-center font-bold">بسم الله الرحمن الرحيم</p>
            <p className="mt-6">معالي وزير الموارد البشرية والتنمية الاجتماعية</p>
            <p className="mt-1">حفظه الله</p>
            <p className="mt-4">السلام عليكم ورحمة الله وبركاته،،</p>
            <p className="mt-4 font-bold">
              الموضوع: {EXAMPLE_LETTER.subject}
            </p>

            {EXAMPLE_LETTER.body.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="mt-4 text-justify">
                {paragraph}
              </p>
            ))}

            <p className="mt-6">وتفضلوا بقبول خالص الشكر والتقدير.</p>

            <dl className="mt-8 space-y-1 text-[0.95em]">
              {[
                ['الاسم', 'محمد بن عبدالله السالم'],
                ['رقم الهوية', '1XXXXXXXXX'],
                ['رقم الجوال', '05XXXXXXXX'],
                ['المدينة', 'الرياض'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="font-semibold">{label}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-subtle-foreground">
          نموذج توضيحي ببيانات افتراضية. {AI_DISCLAIMER_SHORT}
        </p>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function Pricing() {
  return (
    <Section id="pricing" muted>
      <SectionHeading
        title="ابدأ مجاناً، وارتقِ عند الحاجة"
        description="كل الخطط تشمل الجهات وأنواع الطلبات كاملة. الفرق في عدد المعاريض والأدوات المتقدمة."
      />

      <div className="grid gap-5 lg:grid-cols-4">
        {PRICING_PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={cn(
              'relative flex flex-col p-6 surface-flat',
              plan.isPopular && 'border-primary ring-1 ring-primary',
            )}
          >
            {plan.isPopular ? (
              <Badge
                tone="brand"
                className="absolute -top-3 start-1/2 -translate-x-1/2 bg-primary text-primary-foreground rtl:translate-x-1/2"
              >
                الأكثر اختياراً
              </Badge>
            ) : null}

            <h3 className="font-semibold">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">
              {plan.description}
            </p>

            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular">{plan.price}</span>
              <span className="text-sm text-muted-foreground">
                ريال / {plan.period}
              </span>
            </p>

            <p className="mt-3 rounded-lg bg-primary-subtle px-3 py-2 text-center text-sm font-medium text-primary">
              {plan.letters}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-6"
              block
              variant={plan.isPopular ? 'primary' : 'secondary'}
              asChild
            >
              <Link href="/register">{plan.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        الاشتراكات المدفوعة قيد التجهيز. حسابك المجاني يعمل بالكامل من الآن.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

/** قائمة الأسئلة وحدها — تُستخدم في قسم الرئيسية وفي صفحة /faq. */
export function FaqList() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQ_ITEMS.map((item, index) => (
        <AccordionItem key={item.question} value={`item-${index}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading title="أسئلة قد تدور في ذهنك" />

      <div className="mx-auto max-w-3xl">
        <FaqList />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function FinalCta() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,var(--color-brand-700),transparent)]"
          />
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              معروضك الأول يبعد عنك دقائق
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">
              أجب عن عدة أسئلة، ودع الباقي علينا. ٣ معاريض مجاناً كل شهر، بلا
              بطاقة ائتمانية.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/new">ابدأ كتابة معروضك</Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
