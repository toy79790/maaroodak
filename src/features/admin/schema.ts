import { z } from 'zod';
import { sanitizeUserText } from '@/lib/utils/arabic';

/** مخططات لوحة الإدارة — مصدر واحد للتحقق على الخادم والعميل. */

const slug = z
  .string()
  .trim()
  .min(2, 'المعرّف قصير جداً')
  .max(60, 'المعرّف طويل جداً')
  .regex(/^[a-z0-9-]+$/, 'المعرّف بحروف إنجليزية صغيرة وأرقام وشرطات فقط');

const arabicText = (max: number, label: string) =>
  z
    .string()
    .transform(sanitizeUserText)
    .pipe(z.string().min(1, `${label} مطلوب`).max(max, `${label} طويل جداً`));

// --- الجهات -----------------------------------------------------------------

export const departmentSchema = z.object({
  slug,
  name: arabicText(120, 'الاسم'),
  nameEn: z.string().trim().max(120).optional().default(''),
  categoryId: z.string().trim().min(1, 'اختر فئة الجهة'),
  description: z.string().trim().max(500).optional().default(''),
  honorific: z.string().trim().max(60).optional().default(''),
  addressee: z.string().trim().max(160).optional().default(''),
  order: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  /** أنواع الطلبات المرتبطة — استبدال كامل. */
  requestTypeIds: z.array(z.string()).default([]),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

// --- فئات الجهات ------------------------------------------------------------

export const categorySchema = z.object({
  slug,
  name: arabicText(80, 'الاسم'),
  description: z.string().trim().max(300).optional().default(''),
  order: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// --- أنواع الطلبات ----------------------------------------------------------

export const requestTypeSchema = z.object({
  slug,
  name: arabicText(120, 'الاسم'),
  description: z.string().trim().max(500).optional().default(''),
  icon: z.string().trim().max(40).optional().default(''),
  order: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});
export type RequestTypeInput = z.infer<typeof requestTypeSchema>;

// --- الأسئلة ----------------------------------------------------------------

export const QUESTION_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'RADIO',
  'CHECKBOX',
  'YES_NO',
  'FILE',
] as const;

export const CONDITION_OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'CONTAINS',
  'NOT_CONTAINS',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'IS_EMPTY',
  'IS_NOT_EMPTY',
  'IS_TRUE',
  'IS_FALSE',
] as const;

/** عوامل لا تحتاج قيمة مقارنة — تُخفى خانة القيمة في الواجهة. */
export const VALUELESS_OPERATORS = new Set([
  'IS_EMPTY',
  'IS_NOT_EMPTY',
  'IS_TRUE',
  'IS_FALSE',
]);

export const conditionClauseSchema = z.object({
  sourceQuestionKey: z.string().min(1, 'اختر السؤال المصدر'),
  operator: z.enum(CONDITION_OPERATORS),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .nullable()
    .optional(),
});

export const conditionSchema = z.object({
  action: z.enum(['SHOW', 'HIDE', 'REQUIRE', 'OPTIONAL']).default('SHOW'),
  logic: z.enum(['AND', 'OR']).default('AND'),
  clauses: z.array(conditionClauseSchema).min(1, 'أضف شرطاً واحداً على الأقل'),
});

export const questionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, 'المفتاح قصير جداً')
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'المفتاح بحروف إنجليزية صغيرة وأرقام وشرطة سفلية'),
  label: arabicText(300, 'نص السؤال'),
  description: z.string().trim().max(400).optional().default(''),
  type: z.enum(QUESTION_TYPES),
  required: z.boolean().default(true),
  placeholder: z.string().trim().max(160).optional().default(''),
  helpText: z.string().trim().max(300).optional().default(''),
  groupKey: z.string().trim().max(40).optional().default(''),
  order: z.number().int().min(0).max(9999).default(0),
  aiHint: z.string().trim().max(600).optional().default(''),
  departmentId: z.string().nullable().optional(),
  requestTypeId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(1).optional(),
      pattern: z.string().max(200).optional(),
      patternMessage: z.string().max(160).optional(),
      dateRange: z.enum(['past', 'future', 'any']).optional(),
    })
    .nullable()
    .optional(),
  options: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(160),
      }),
    )
    .default([]),
  conditions: z.array(conditionSchema).default([]),
});
export type QuestionInput = z.infer<typeof questionSchema>;

// --- القوالب ----------------------------------------------------------------

export const templateSchema = z.object({
  slug,
  name: arabicText(120, 'الاسم'),
  description: z.string().trim().max(400).optional().default(''),
  body: z.string().min(20, 'القالب قصير جداً').max(20000),
  departmentId: z.string().nullable().optional(),
  requestTypeId: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type TemplateInput = z.infer<typeof templateSchema>;

// --- الموجّهات ---------------------------------------------------------------

export const promptSchema = z.object({
  key: z.string().trim().min(2).max(80),
  name: arabicText(120, 'الاسم'),
  description: z.string().trim().max(400).optional().default(''),
  type: z.string().min(2),
  content: z.string().min(10, 'المحتوى قصير جداً').max(20000),
  model: z.string().trim().max(60).optional().default(''),
  maxTokens: z.number().int().min(256).max(64000).nullable().optional(),
  departmentId: z.string().nullable().optional(),
  requestTypeId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type PromptInput = z.infer<typeof promptSchema>;

// --- المستخدمون --------------------------------------------------------------

export const userUpdateSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  isActive: z.boolean().optional(),
  /** تعديل الرصيد — موجب للمنح وسالب للسحب. */
  creditAdjustment: z.number().int().min(-10000).max(10000).optional(),
  adjustmentNote: z.string().trim().max(200).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// --- الإعدادات ---------------------------------------------------------------

export const settingSchema = z.object({
  key: z.string().min(2).max(80),
  value: z.unknown(),
});
