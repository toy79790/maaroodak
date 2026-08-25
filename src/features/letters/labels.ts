import type { LetterStatus, VersionSource } from '@prisma/client';

/**
 * التسميات العربية للتعدادات — مصدر واحد.
 * تكرارها في كل شاشة يؤدي حتماً إلى تسميتين مختلفتين للحالة نفسها.
 */

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export const LETTER_STATUS_LABEL: Record<LetterStatus | string, string> = {
  DRAFT: 'مسودة',
  GENERATING: 'قيد التوليد',
  GENERATED: 'تم التوليد',
  EDITED: 'مُعدَّل',
  COMPLETED: 'مكتمل',
  ARCHIVED: 'مؤرشف',
  FAILED: 'فشل',
};

export const LETTER_STATUS_TONE: Record<LetterStatus | string, BadgeTone> = {
  DRAFT: 'neutral',
  GENERATING: 'info',
  GENERATED: 'brand',
  EDITED: 'brand',
  COMPLETED: 'success',
  ARCHIVED: 'neutral',
  FAILED: 'danger',
};

export const VERSION_SOURCE_LABEL: Record<VersionSource | string, string> = {
  AI_GENERATED: 'توليد بالذكاء الاصطناعي',
  USER_EDIT: 'تعديل يدوي',
  AI_TOOL: 'أداة ذكاء اصطناعي',
  RESTORED: 'استعادة نسخة',
};

export const DEPARTMENT_CATEGORY_LABEL: Record<string, string> = {
  GOVERNMENT: 'جهات حكومية',
  SERVICE: 'جهات خدمية',
  EDUCATION: 'جهات تعليمية',
  PRIVATE: 'جهات خاصة',
  OTHER: 'أخرى',
};

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  TEXT: 'نص قصير',
  TEXTAREA: 'نص طويل',
  NUMBER: 'رقم',
  DATE: 'تاريخ',
  SELECT: 'قائمة منسدلة',
  RADIO: 'اختيار واحد',
  CHECKBOX: 'اختيار متعدد',
  YES_NO: 'نعم / لا',
  FILE: 'رفع ملف',
};
