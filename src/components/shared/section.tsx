import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Container } from '@/components/ui/container';

export function Section({
  className,
  children,
  id,
  muted,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
  muted?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-24',
        muted && 'bg-surface-muted/60',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/**
 * ترويسة قسم.
 *
 * لا عنوان فرعي فوق العنوان: كان يكرّر ما يقوله العنوان نفسه («كيف تعمل»
 * فوق «أربع خطوات…») فيقرأ كزينة قالبية لا كمعلومة.
 *
 * والمحاذاة تبدأ من اليمين افتراضاً: العربية تُقرأ من حافة يمنى ثابتة،
 * وتوسيط سبعة عناوين متتالية يهدر تلك الحافة.
 */
export function SectionHeading({
  title,
  description,
  align = 'start',
}: {
  title: string;
  description?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={cn(
        'mb-12 max-w-2xl',
        align === 'center' ? 'mx-auto text-center' : 'text-start',
      )}
    >
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
