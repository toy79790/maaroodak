import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { TRUST_POINTS } from '@/features/marketing/content';
import { site } from '@/config/site';

/**
 * الواجهة البصرية للـ Hero: بطاقة سؤال + ورقة معروض خلفها.
 * ثابتة (لا تفاعل) عمداً — تشرح المنتج في نظرة واحدة بلا تكلفة جافاسكربت.
 *
 * الورقة نصّ عربي حقيقي بخط النسخ لا أشرطة رمادية: مخرَج المنتج هو هويته،
 * وإظهاره في أول شاشة يقول ما لا تقوله أي عبارة تسويقية.
 */
function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      {/* ورقة المعروض في الخلف */}
      <div className="absolute -top-4 end-0 start-8 rotate-[-2deg] overflow-hidden rounded-xl border border-border bg-white px-7 pb-24 pt-6 shadow-lift sm:start-14">
        <div className="text-[0.8rem] leading-[2.1] text-[#3a3a3a] [font-family:var(--font-letter)]">
          <p className="text-center font-bold text-[#111]">
            بسم الله الرحمن الرحيم
          </p>
          <p className="mt-4 text-[#111]">
            معالي وزير الموارد البشرية والتنمية الاجتماعية
          </p>
          <p>حفظه الله</p>
          <p className="mt-3">السلام عليكم ورحمة الله وبركاته،،</p>
          <p className="mt-3 font-bold text-[#111]">
            الموضوع: طلب مساعدة مالية عاجلة
          </p>
          <p className="mt-3">
            أتقدم إلى سعادتكم بهذا المعروض راجياً من الله ثم منكم النظر في
            طلبي، وأنا مواطن أعول أسرة مكوّنة من ستة أفراد.
          </p>
        </div>
      </div>

      {/* بطاقة المقابلة في المقدمة */}
      {/* البطاقة تنزل بما يكفي لكشف رأس الخطاب كاملاً خلفها: البسملة
          والمخاطَب والموضوع — لا سطرين مبتورين. */}
      <div className="relative mt-32 rounded-2xl border border-border bg-surface p-6 shadow-lift sm:me-10">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular">السؤال ٣ من ٩</span>
          <span className="inline-flex items-center gap-1.5 text-primary">
            <Sparkles className="size-3.5" />
            مقابلة ذكية
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-1/3 rounded-full bg-primary" />
        </div>

        <p className="mt-6 text-lg font-semibold leading-snug">
          هل لديك مديونية قائمة؟
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          إجابتك تحدّد الأسئلة التالية.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="flex items-center justify-center gap-2 rounded-[var(--radius-field)] border-2 border-primary bg-primary-subtle px-4 py-3 text-sm font-medium text-primary">
            <Check className="size-4" />
            نعم
          </div>
          <div className="flex items-center justify-center rounded-[var(--radius-field)] border border-border-strong px-4 py-3 text-sm text-muted-foreground">
            لا
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-xs text-muted-foreground">
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
          ستُطرح ٥ أسئلة إضافية عن المديونية
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Container className="relative">
        <div className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-8 lg:py-28">
          <div className="animate-fade-up text-center lg:text-start">
            <h1 className="text-3xl font-bold leading-[1.25] sm:text-4xl lg:text-5xl lg:leading-[1.2]">
              {site.tagline}
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              {site.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button size="lg" asChild>
                <Link href="/new">ابدأ كتابة معروضك</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#how-it-works">اطّلع على الخطوات</a>
              </Button>
            </div>

            <ul className="mt-9 flex flex-wrap justify-center gap-x-5 gap-y-2.5 lg:justify-start">
              {TRUST_POINTS.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <HeroVisual />
        </div>
      </Container>
    </section>
  );
}
