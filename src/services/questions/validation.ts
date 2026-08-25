import { z } from 'zod';
import type { AnswerValue, QuestionDef } from '@/types/questions';
import { LIMITS } from '@/config/constants';
import { sanitizeUserText, toLatinDigits } from '@/lib/utils/arabic';

/**
 * بناء مخطط تحقق ديناميكي من تعريف السؤال.
 *
 * الأسئلة بيانات لا كود، فلا يمكن كتابة مخطط ثابت لكل سؤال.
 * التحقق يجري على الخادم دائماً — ما يصل من العميل غير موثوق.
 */

function optionValues(question: QuestionDef): [string, ...string[]] {
  const values = question.options.map((option) => option.value);
  // z.enum يتطلب عنصراً واحداً على الأقل؛ سؤال بلا خيارات خطأ إعداد.
  return values.length > 0 ? (values as [string, ...string[]]) : ['__none__'];
}

export function buildAnswerSchema(question: QuestionDef): z.ZodType<AnswerValue> {
  const rules = question.validation ?? {};

  switch (question.type) {
    case 'TEXT':
    case 'TEXTAREA': {
      const maxLength =
        rules.maxLength ??
        (question.type === 'TEXTAREA' ? LIMITS.textareaAnswer : LIMITS.textAnswer);

      let schema = z
        .string()
        .transform(sanitizeUserText)
        .pipe(
          z
            .string()
            .min(rules.minLength ?? 0, `الحد الأدنى ${rules.minLength} حرفاً`)
            .max(maxLength, `الحد الأقصى ${maxLength} حرفاً`),
        ) as unknown as z.ZodType<string>;

      if (rules.pattern) {
        const pattern = safeRegExp(rules.pattern);
        if (pattern) {
          schema = schema.refine(
            (value) => value === '' || pattern.test(value),
            rules.patternMessage ?? 'الصيغة غير صحيحة',
          ) as unknown as z.ZodType<string>;
        }
      }

      return schema as z.ZodType<AnswerValue>;
    }

    case 'NUMBER': {
      const min = rules.min ?? LIMITS.numberMin;
      const max = rules.max ?? LIMITS.numberMax;

      return z
        .union([z.number(), z.string()])
        .transform((value) => {
          if (typeof value === 'number') return value;
          const cleaned = toLatinDigits(value).replace(/[,،\s]/g, '');
          return cleaned === '' ? Number.NaN : Number(cleaned);
        })
        .pipe(
          z
            .number({ error: 'أدخل رقماً صحيحاً' })
            .min(min, `القيمة يجب ألّا تقل عن ${min}`)
            .max(max, `القيمة يجب ألّا تزيد عن ${max}`),
        ) as unknown as z.ZodType<AnswerValue>;
    }

    case 'DATE': {
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة')
        .refine((value) => !Number.isNaN(Date.parse(value)), 'تاريخ غير صالح')
        .refine((value) => {
          if (rules.dateRange === 'past') return Date.parse(value) <= Date.now();
          if (rules.dateRange === 'future') return Date.parse(value) >= Date.now();
          return true;
        }, rules.dateRange === 'past' ? 'يجب أن يكون تاريخاً في الماضي' : 'يجب أن يكون تاريخاً في المستقبل')
        .refine((value) => {
          // نطاق معقول يمنع أخطاء الإدخال الجسيمة (سنة 0202 مثلاً).
          const year = Number(value.slice(0, 4));
          return year >= 1900 && year <= new Date().getFullYear() + 20;
        }, 'السنة خارج النطاق المعقول') as unknown as z.ZodType<AnswerValue>;
    }

    case 'SELECT':
    case 'RADIO':
      return z.enum(optionValues(question), {
        error: 'اختر أحد الخيارات المتاحة',
      }) as unknown as z.ZodType<AnswerValue>;

    case 'CHECKBOX': {
      const allowed = new Set(question.options.map((option) => option.value));
      return z
        .array(z.string())
        .refine(
          (values) => values.every((value) => allowed.has(value)),
          'أحد الخيارات غير صالح',
        )
        .refine(
          (values) => !question.required || values.length > 0,
          'اختر خياراً واحداً على الأقل',
        ) as unknown as z.ZodType<AnswerValue>;
    }

    case 'YES_NO':
      return z
        .union([z.boolean(), z.literal('true'), z.literal('false')])
        .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
        .pipe(z.boolean()) as unknown as z.ZodType<AnswerValue>;

    case 'FILE':
      // v1: نخزّن أسماء الملفات المرفوعة فقط — الرفع الفعلي مسار منفصل.
      return z
        .array(z.string().max(255))
        .max(10, 'الحد الأقصى 10 ملفات') as unknown as z.ZodType<AnswerValue>;

    default: {
      const exhaustive: never = question.type;
      return exhaustive;
    }
  }
}

/**
 * تعبير نمطي من الإدارة — قد يكون تالفاً أو كارثي التعقيد.
 * نُقيّد الطول ونلتقط أخطاء البناء بدل أن يسقط الطلب.
 */
function safeRegExp(pattern: string): RegExp | null {
  if (pattern.length > 200) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export interface AnswerValidationResult {
  ok: boolean;
  value?: AnswerValue;
  error?: string;
}

export function validateAnswer(
  question: QuestionDef,
  raw: unknown,
): AnswerValidationResult {
  // سؤال اختياري بقيمة فارغة: مقبول ويُخزَّن كـ null.
  const isEmpty =
    raw === undefined ||
    raw === null ||
    raw === '' ||
    (Array.isArray(raw) && raw.length === 0);

  if (isEmpty) {
    if (question.required) {
      return { ok: false, error: 'هذا الحقل مطلوب' };
    }
    return { ok: true, value: null };
  }

  const parsed = buildAnswerSchema(question).safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'قيمة غير صالحة',
    };
  }

  return { ok: true, value: parsed.data };
}
