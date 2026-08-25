import { z } from 'zod';

/**
 * مخططات المخرجات المهيكلة — docs/AI_SYSTEM.md §7 و §8
 *
 * تُمرَّر مباشرة إلى `zodOutputFormat`، ويُستخدم نفس المخطط للتحقق من الرد.
 * مصدر حقيقة واحد بدل تحليل JSON يدوي هشّ.
 */

export const checkSchema = z.object({
  passed: z.boolean().describe('هل اجتاز هذا الفحص؟'),
  severity: z
    .enum(['none', 'info', 'warning', 'critical'])
    .describe('خطورة الملاحظة — none عند النجاح'),
  message: z.string().describe('رسالة عربية موجّهة للمستخدم'),
  evidence: z.array(z.string()).describe('اقتباسات حرفية قصيرة من النص'),
  suggestion: z.string().nullable().describe('اقتراح للتحسين، أو null'),
});

export type QualityCheck = z.infer<typeof checkSchema>;

export const qualityReportSchema = z.object({
  usesOnlyProvidedInfo: checkSchema,
  hasContradiction: checkSchema,
  hasRepetition: checkSchema,
  requestIsClear: checkSchema,
  departmentIsSuitable: checkSchema,
  toneIsFormal: checkSchema,
  languageIsCorrect: checkSchema,
  missingInformation: checkSchema,
  overallScore: z.number().min(0).max(100).describe('جاهزية المعروض للتقديم'),
  summary: z.string().describe('خلاصة الفحص في جملة أو جملتين'),
});

export type QualityReport = z.infer<typeof qualityReportSchema>;

/** ترتيب عرض الفحوص وتسمياتها العربية. */
export const QUALITY_CHECK_LABELS: ReadonlyArray<{
  key: keyof Omit<QualityReport, 'overallScore' | 'summary'>;
  label: string;
}> = [
  { key: 'usesOnlyProvidedInfo', label: 'المعلومات من إجاباتك فقط' },
  { key: 'missingInformation', label: 'اكتمال المعلومات' },
  { key: 'requestIsClear', label: 'وضوح الطلب' },
  { key: 'departmentIsSuitable', label: 'مناسبة الجهة' },
  { key: 'toneIsFormal', label: 'الأسلوب الرسمي' },
  { key: 'languageIsCorrect', label: 'سلامة اللغة' },
  { key: 'hasContradiction', label: 'خلوّه من التناقض' },
  { key: 'hasRepetition', label: 'خلوّه من التكرار' },
];

// ---------------------------------------------------------------------------

export const followUpQuestionSchema = z.object({
  key: z
    .string()
    .describe('مفتاح إنجليزي بحروف صغيرة وشرطات سفلية، لا يطابق مفتاحاً موجوداً'),
  question: z.string().describe('نص السؤال بالعربية موجّهاً للمستخدم'),
  why: z.string().describe('جملة واحدة: لماذا تُقوّي هذه المعلومة الطلب'),
  type: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'YES_NO']),
  importance: z.enum(['critical', 'helpful']),
});

export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>;

export const followUpResultSchema = z.object({
  questions: z.array(followUpQuestionSchema).max(5),
});

export type FollowUpResult = z.infer<typeof followUpResultSchema>;

/** مفاتيح لا يجوز للذكاء الاصطناعي أن يسأل عنها — docs/AI_SYSTEM.md §8 */
export const FORBIDDEN_FOLLOW_UP_PATTERNS: readonly RegExp[] = [
  /password|كلمة.?المرور/i,
  /\bpin\b|الرقم.?السري/i,
  /cvv|card.?number|رقم.?البطاق/i,
  /otp|رمز.?التحقق/i,
  /iban|رقم.?الايبان|رقم.?الآيبان/i,
  /account_number|رقم.?الحساب.?كامل/i,
];

export const titleSuggestionsSchema = z.object({
  titles: z.array(z.string().min(4).max(120)).min(1).max(3),
});

export type TitleSuggestions = z.infer<typeof titleSuggestionsSchema>;
