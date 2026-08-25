'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { AnswerValue, QuestionDef } from '@/types/questions';
import { LIMITS } from '@/config/constants';

/**
 * عرض حقل الإجابة حسب نوع السؤال.
 *
 * كل الأنواع التسعة مدعومة هنا في مكان واحد — إضافة نوع جديد تلمس هذا الملف
 * و`validation.ts` فقط.
 */

interface QuestionInputProps {
  question: QuestionDef;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
  autoFocus?: boolean;
}

/** بطاقة اختيار كبيرة — أسهل للمس على الجوال من زر الراديو الصغير. */
function ChoiceCard({
  selected,
  label,
  description,
  onSelect,
  name,
  value,
  multiple,
}: {
  selected: boolean;
  label: string;
  description?: string;
  onSelect: () => void;
  name: string;
  value: string;
  multiple?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[var(--radius-field)] border-2 p-4 transition-colors',
        selected
          ? 'border-primary bg-primary-subtle'
          : 'border-border-strong hover:border-sand-400 hover:bg-surface-muted/60',
      )}
    >
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 transition-colors',
          multiple ? 'rounded-md' : 'rounded-full',
          selected ? 'border-primary bg-primary text-white' : 'border-sand-400',
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm', selected && 'font-medium')}>
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function QuestionInput({
  question,
  value,
  onChange,
  error,
  autoFocus,
}: QuestionInputProps) {
  const fieldId = `q-${question.key}`;
  const aria = {
    id: fieldId,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${fieldId}-error` : undefined,
  };

  switch (question.type) {
    case 'TEXTAREA': {
      const text = typeof value === 'string' ? value : '';
      const maxLength = question.validation?.maxLength ?? LIMITS.textareaAnswer;

      return (
        <div>
          <Textarea
            {...aria}
            rows={6}
            autoFocus={autoFocus}
            value={text}
            maxLength={maxLength}
            placeholder={question.placeholder ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
          <p className="tabular mt-1.5 text-start text-xs text-subtle-foreground">
            {text.length} / {maxLength}
          </p>
        </div>
      );
    }

    case 'NUMBER':
      return (
        <Input
          {...aria}
          type="number"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
          placeholder={question.placeholder ?? ''}
          min={question.validation?.min}
          max={question.validation?.max}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : Number(event.target.value))
          }
        />
      );

    case 'DATE':
      return (
        <Input
          {...aria}
          type="date"
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      );

    case 'YES_NO': {
      const current = typeof value === 'boolean' ? value : null;
      return (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={question.label}>
          {[
            { label: 'نعم', selected: current === true, next: true },
            { label: 'لا', selected: current === false, next: false },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={option.selected}
              onClick={() => onChange(option.next)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-[var(--radius-field)] border-2 px-4 py-3.5 text-sm transition-colors',
                option.selected
                  ? 'border-primary bg-primary-subtle font-medium text-primary'
                  : 'border-border-strong text-muted-foreground hover:border-sand-400 hover:bg-surface-muted/60',
              )}
            >
              {option.selected ? <Check className="size-4" /> : null}
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    case 'RADIO':
      return (
        <div className="space-y-2.5" role="radiogroup" aria-label={question.label}>
          {question.options.map((option) => (
            <ChoiceCard
              key={option.value}
              name={fieldId}
              value={option.value}
              label={option.label}
              selected={value === option.value}
              onSelect={() => onChange(option.value)}
            />
          ))}
        </div>
      );

    case 'SELECT':
      return (
        <select
          {...aria}
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          className={cn(
            'w-full rounded-[var(--radius-field)] border border-border-strong bg-surface',
            'px-3.5 py-3 text-[0.95rem]',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'aria-[invalid=true]:border-danger',
          )}
        >
          <option value="">— اختر —</option>
          {question.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'CHECKBOX': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2.5" role="group" aria-label={question.label}>
          {question.options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <ChoiceCard
                key={option.value}
                multiple
                name={fieldId}
                value={option.value}
                label={option.label}
                selected={isSelected}
                onSelect={() =>
                  onChange(
                    isSelected
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
            );
          })}
        </div>
      );
    }

    case 'FILE':
      // v1: نسجّل أسماء المرفقات فقط — الرفع الفعلي مسار مستقل لاحقاً.
      return (
        <div className="rounded-[var(--radius-field)] border border-dashed border-border-strong p-5 text-center">
          <p className="text-sm text-muted-foreground">
            رفع الملفات غير متاح في هذه النسخة. أرفق مستنداتك ورقياً مع المعروض.
          </p>
        </div>
      );

    case 'TEXT':
    default:
      return (
        <Input
          {...aria}
          autoFocus={autoFocus}
          value={typeof value === 'string' ? value : ''}
          placeholder={question.placeholder ?? ''}
          maxLength={question.validation?.maxLength ?? LIMITS.textAnswer}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
