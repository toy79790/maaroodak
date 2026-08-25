import { z } from 'zod';
import { sanitizeUserText } from '@/lib/utils/arabic';

/**
 * مخططات المصادقة — مصدر واحد للتحقق على الخادم والعميل.
 * كل الرسائل عربية وصالحة للعرض المباشر تحت الحقل.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'البريد الإلكتروني مطلوب')
  .max(254, 'البريد الإلكتروني طويل جداً')
  .pipe(z.email('صيغة البريد الإلكتروني غير صحيحة'));

export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(128, 'كلمة المرور طويلة جداً');

export const nameSchema = z
  .string()
  .transform(sanitizeUserText)
  .pipe(
    z
      .string()
      .min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل')
      .max(80, 'الاسم طويل جداً'),
  );

/** جوال سعودي: 05XXXXXXXX أو 9665XXXXXXXX أو +9665XXXXXXXX */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine(
    (value) => value === '' || /^(?:\+?966|0)5\d{8}$/.test(value),
    'رقم الجوال غير صحيح. مثال: 0512345678',
  )
  .transform((value) =>
    value === '' ? '' : value.replace(/^(?:\+?966)/, '0').replace(/^0?5/, '05'),
  );

export const nationalIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[12]\d{9}$/.test(value),
    'رقم الهوية يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2',
  );

// --- النماذج ----------------------------------------------------------------

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().default(''),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'رابط الاستعادة غير صالح'),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  current: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  next: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  city: z
    .string()
    .transform(sanitizeUserText)
    .pipe(z.string().max(60, 'اسم المدينة طويل جداً'))
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
