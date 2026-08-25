'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

/**
 * حقل كلمة مرور بزر إظهار/إخفاء.
 * إخفاء كلمة المرور بلا وسيلة لكشفها يزيد أخطاء الإدخال — خصوصاً على الجوال.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pe-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-[var(--radius-field)] text-muted-foreground hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="size-4.5" aria-hidden />
          ) : (
            <Eye className="size-4.5" aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
