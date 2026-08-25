/**
 * تعريفات أدوات التحرير — **صالحة للعميل والخادم معاً**.
 *
 * مفصولة عن `ai-tools-service.ts` عمداً: الأخير يستورد Prisma و`server-only`،
 * فاستيراد أي شيء منه في مكوّن عميل يُفشل البناء ويسحب طبقة البيانات
 * إلى حزمة المتصفح.
 */

export const AI_TOOLS = [
  'IMPROVE',
  'FORMALIZE',
  'SHORTEN',
  'EXPAND',
  'CLARIFY',
  'REWRITE',
  'TITLE',
  'INTRO',
  'CONCLUSION',
  'PROOFREAD',
] as const;

export type AiTool = (typeof AI_TOOLS)[number];

export const AI_TOOL_LABELS: Record<AiTool, string> = {
  IMPROVE: 'تحسين الصياغة',
  FORMALIZE: 'صياغة رسمية أكثر',
  SHORTEN: 'اختصار المعروض',
  EXPAND: 'توسيع المعروض',
  CLARIFY: 'توضيح الطلب',
  REWRITE: 'إعادة كتابة',
  TITLE: 'اقتراح عنوان',
  INTRO: 'تحسين المقدمة',
  CONCLUSION: 'تحسين الخاتمة',
  PROOFREAD: 'تدقيق لغوي',
};

/** أدوات تقترح ولا تُعدّل المعروض — لا تُنشئ نسخة جديدة. */
export const SUGGESTION_ONLY_TOOLS: ReadonlySet<AiTool> = new Set(['TITLE']);

/** أدوات لا معنى لتطبيقها على تحديد جزئي. */
export const WHOLE_LETTER_ONLY_TOOLS: ReadonlySet<AiTool> = new Set([
  'TITLE',
  'INTRO',
  'CONCLUSION',
]);
