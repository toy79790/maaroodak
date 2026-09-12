import type { AnswerMap, QuestionDef } from '@/types/questions';
import type { TemplateContext, TemplateValue } from '@/services/templates/engine';
import { formatArabicDate } from '@/lib/utils/arabic';
import { site } from '@/config/site';

/**
 * بناء سياق القالب من ملف المستخدم والجهة والإجابات.
 *
 * ثلاث فئات من المتغيرات:
 *   نظام  : today · platform_name
 *   سياق  : department_name · department_addressee · request_type_name · subject
 *   إجابة : a.<question_key>  — ونسخة بلا بادئة لتسهيل كتابة القوالب
 */

export const SYSTEM_VARIABLES = [
  'today',
  'platform_name',
  'department_name',
  'department_addressee',
  'department_honorific',
  'request_type_name',
  'subject',
  'full_name',
  'national_id',
  'phone',
  'city',
  'ai_body',
] as const;

export interface VariableSource {
  user: {
    name: string;
    nationalId?: string | null;
    phone?: string | null;
    city?: string | null;
  };
  department: { name: string; addressee?: string | null; honorific?: string | null };
  requestType: { name: string };
  subject: string;
  answers: AnswerMap;
  questions: readonly QuestionDef[];
  aiBody?: string;
  now?: Date;
}

/** تحويل قيمة إجابة إلى نص صالح للقالب (تسمية الخيار لا قيمته). */
function answerToText(question: QuestionDef, value: unknown): TemplateValue {
  if (value === null || value === undefined) return null;

  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';

  if (Array.isArray(value)) {
    const labels = value.map(
      (item) =>
        question.options.find((option) => option.value === item)?.label ??
        String(item),
    );
    return labels.join('، ');
  }

  const option = question.options.find((item) => item.value === value);
  if (option) return option.label;

  return typeof value === 'number' ? value : String(value);
}

/** هل للإجابة قيمة فعلية؟ الفراغ والمسافات وحدها ليست إجابة. */
function hasValue(value: TemplateValue): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function buildTemplateContext(source: VariableSource): TemplateContext {
  const now = source.now ?? new Date();

  const byKey = new Map(source.questions.map((question) => [question.key, question]));

  // الإجابات أولاً: بيانات الهوية أدناه تحتاج أن تقرأها.
  const answered = new Map<string, TemplateValue>();

  for (const [key, value] of Object.entries(source.answers)) {
    const question = byKey.get(key);
    if (!question) continue;
    answered.set(key, answerToText(question, value));
  }

  /**
   * بيانات الهوية: إجابة المقابلة تتقدّم على الملف الشخصي — docs/DECISIONS.md #D-034
   *
   * المعروض يُرفع عن صاحب الطلب لا عن صاحب الحساب، وهما قد يختلفان.
   * والملف قد يكون ناقصاً أصلاً، فيسقط سطر من خانة البيانات رغم أن المستخدم أجاب عنه.
   */
  function identity(key: string, profile: string | null | undefined): TemplateValue {
    const answer = answered.get(key);
    return hasValue(answer) ? (answer as TemplateValue) : (profile ?? null);
  }

  const context: TemplateContext = {
    today: formatArabicDate(now),
    platform_name: site.name,

    department_name: source.department.name,
    department_addressee:
      source.department.addressee ?? source.department.name,
    department_honorific: source.department.honorific ?? '',

    request_type_name: source.requestType.name,
    subject: source.subject,

    full_name: identity('full_name', source.user.name),
    national_id: identity('national_id', source.user.nationalId),
    phone: identity('phone', source.user.phone),
    city: identity('city', source.user.city),

    ai_body: source.aiBody ?? '',
  };

  for (const [key, text] of answered) {
    // متاح بالبادئة وبدونها. القوالب تُكتب من لوحة التحكم، وتقييد الكاتب
    // على بادئة واحدة مصدر أخطاء صامتة (متغيّر لا يُستبدل).
    context[`a.${key}`] = text;
    if (!(key in context)) context[key] = text;
  }

  return context;
}

/**
 * موضوع المعروض — يُستخدم في سطر «الموضوع:» وعنوان المعروض.
 * يُشتق من نوع الطلب افتراضياً، ويُستبدل لاحقاً بعنوان يقترحه الذكاء الاصطناعي.
 */
export function defaultSubject(
  requestTypeName: string,
  answers: AnswerMap,
): string {
  const explicitSubjectKeys = [
    'complaint_subject',
    'objection_subject',
    'decision_subject',
    'exemption_subject',
    'job_title',
    'meeting_topic',
  ];

  for (const key of explicitSubjectKeys) {
    const value = answers[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return `${requestTypeName} — ${value.trim().slice(0, 80)}`;
    }
  }

  return requestTypeName;
}
