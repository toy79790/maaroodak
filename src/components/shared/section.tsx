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

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string;
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
      {eyebrow ? (
        <p className="mb-3 text-sm font-semibold text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-4 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
