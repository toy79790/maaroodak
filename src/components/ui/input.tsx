import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const fieldBase = [
  'w-full rounded-[var(--radius-field)] border border-border-strong bg-surface',
  'px-3.5 py-2.5 text-[0.95rem] text-foreground',
  'placeholder:text-subtle-foreground',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-sand-400',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20',
];

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        // الأرقام والبريد والهاتف تُكتب من اليسار حتى داخل واجهة RTL
        dir={
          type === 'email' || type === 'tel' || type === 'number' || type === 'url'
            ? 'ltr'
            : undefined
        }
        className={cn(
          fieldBase,
          (type === 'email' || type === 'tel' || type === 'number' || type === 'url') &&
            'text-start',
          className,
        )}
        {...props}
      />
    );
  },
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(fieldBase, 'resize-y leading-relaxed', className)}
        {...props}
      />
    );
  },
);

export { fieldBase };
