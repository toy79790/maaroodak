import { Container } from '@/components/ui/container';

/**
 * ترويسة الصفحات التعريفية (من نحن · تواصل · الجهات …) — بنفس إيقاع
 * `LegalPage` حتى تبدو الصفحات الثانوية عائلة واحدة.
 */
export function PageIntro({
  title,
  intro,
  children,
  wide,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  /** الصفحات ذات الشبكات (الجهات) تحتاج عرض الموقع كاملاً لا عرض القراءة. */
  wide?: boolean;
}) {
  return (
    <Container className={wide ? 'py-16 sm:py-20' : 'max-w-3xl py-16 sm:py-20'}>
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-10">{children}</div>
    </Container>
  );
}

/**
 * نص مؤقت ظاهر — لبيانات لم تُحسم بعد (الجهة المالكة، قنوات التواصل).
 * ظاهر عمداً بإطار متقطّع: يُكتشف في المراجعة ولا يمرّ كمحتوى حقيقي.
 */
export function PendingContent({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-field)] border border-dashed border-border-strong bg-surface-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
