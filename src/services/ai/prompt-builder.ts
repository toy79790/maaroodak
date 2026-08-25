import type { AnswerMap, QuestionDef } from '@/types/questions';
import type { SystemBlock } from '@/services/ai/ports';
import { CORE_GUARDRAILS, escapeForFactBlock } from '@/services/ai/guardrails';

/**
 * بناء الـ Prompt — docs/AI_SYSTEM.md §3
 *
 * دالة نقية: تستقبل سياقاً وتُرجع نصاً. لا قاعدة بيانات ولا شبكة، فيمكن
 * اختبار كل قرار صياغة بمدخل واحد.
 *
 * ترتيب الطبقات مقصود ولا يتغيّر: L1→L4 ثابتة عبر كل طلبات نفس (الجهة،
 * النوع) ⇒ تُخزَّن مؤقتاً. L5 متغيّرة ⇒ تأتي أخيراً. التخزين المؤقت مطابقة
 * بادئة، فأي تقديم للمتغيّر يُبطل التخزين بالكامل.
 */

export interface PromptLayers {
  /** L2 — قواعد الأسلوب من قاعدة البيانات. */
  style: string;
  /** L3 — سياق الجهة. */
  department?: string | null;
  /** L4 — سياق نوع الطلب. */
  requestType?: string | null;
  /** تعليمات إضافية للعملية (توليد، إعادة توليد بتحذير…). */
  task?: string | null;
}

export interface GenerationContext {
  department: { name: string; addressee?: string | null };
  requestType: { name: string };
  applicantName: string;
  answers: AnswerMap;
  questions: readonly QuestionDef[];
  layers: PromptLayers;
  /** موضوع المعروض المقترح. */
  subject: string;
  /** تحذير إعادة التوليد بعد مخالفة ضوابط. */
  regenerationNote?: string | null;
}

export interface BuiltPrompt {
  system: SystemBlock[];
  user: string;
}

/** يحوّل قيمة الإجابة إلى نص مقروء للنموذج. */
function answerText(question: QuestionDef, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value
      .map(
        (item) =>
          question.options.find((option) => option.value === item)?.label ??
          String(item),
      )
      .join('، ');
  }

  const option = question.options.find((item) => item.value === value);
  return option ? option.label : String(value);
}

/**
 * كتلة الحقائق.
 *
 * تُبنى من الأسئلة **المرئية فقط** — إجابة سؤال أُخفي لاحقاً لا تدخل
 * المعروض (docs/DECISIONS.md #D-015). ويُهرَّب كل نص المستخدم حتى لا
 * يستطيع إغلاق الوسم وحقن تعليمات.
 */
export function buildFactsBlock(
  questions: readonly QuestionDef[],
  answers: AnswerMap,
): { block: string; facts: string[] } {
  const lines: string[] = [];
  const facts: string[] = [];

  for (const question of questions) {
    const text = answerText(question, answers[question.key]);
    if (text === null) continue;

    const safe = escapeForFactBlock(text);
    facts.push(text);

    // تلميح الاستخدام يُرفق مع الحقيقة لا في تعليمات منفصلة: النموذج
    // يربطهما مباشرة بدل أن يبحث عن التلميح في مكان آخر.
    const hint = question.aiHint ? `\n  توجيه: ${escapeForFactBlock(question.aiHint)}` : '';
    lines.push(`- ${escapeForFactBlock(question.label)}: ${safe}${hint}`);
  }

  return {
    block: `<user_facts>\n${lines.join('\n')}\n</user_facts>`,
    facts,
  };
}

export function buildGenerationPrompt(context: GenerationContext): BuiltPrompt {
  const { block: factsBlock } = buildFactsBlock(context.questions, context.answers);

  const system: SystemBlock[] = [
    // L1 — الهوية والضوابط. ثابتة أبداً ⇒ تُخزَّن مؤقتاً.
    { text: CORE_GUARDRAILS, cache: true },
    // L2 — الأسلوب.
    { text: context.layers.style, cache: true },
  ];

  if (context.layers.department) {
    system.push({ text: context.layers.department, cache: true });
  }
  if (context.layers.requestType) {
    system.push({ text: context.layers.requestType, cache: true });
  }
  if (context.layers.task) {
    system.push({ text: context.layers.task, cache: false });
  }

  const userParts = [
    `الجهة المخاطَبة: ${context.department.name}`,
    context.department.addressee
      ? `صيغة المخاطبة في القالب: ${context.department.addressee}`
      : null,
    `نوع الطلب: ${context.requestType.name}`,
    `موضوع المعروض: ${context.subject}`,
    '',
    'معلومات المستخدم:',
    factsBlock,
    '',
    'اكتب الآن متن المعروض بناءً على ما سبق حصراً.',
  ];

  if (context.regenerationNote) {
    userParts.push(
      '',
      `⚠️ تنبيه من محاولة سابقة: ${context.regenerationNote}`,
      'التزم بالقواعد بدقة أكبر هذه المرة.',
    );
  }

  return {
    system,
    user: userParts.filter((part) => part !== null).join('\n'),
  };
}

// ---------------------------------------------------------------------------
// أدوات التحرير
// ---------------------------------------------------------------------------

export interface ToolContext {
  /** تعليمات الأداة من قاعدة البيانات. */
  instruction: string;
  /** النص المستهدف — كامل المعروض أو التحديد. */
  text: string;
  /** الحقائق — تُمرَّر للأدوات التي قد تُغري بالاختراع (التوسيع خاصة). */
  questions?: readonly QuestionDef[];
  answers?: AnswerMap;
  department?: { name: string } | null;
  requestType?: { name: string } | null;
}

export function buildToolPrompt(context: ToolContext): BuiltPrompt {
  const system: SystemBlock[] = [
    { text: CORE_GUARDRAILS, cache: true },
    { text: context.instruction, cache: false },
  ];

  const parts: string[] = [];

  if (context.department) parts.push(`الجهة المخاطَبة: ${context.department.name}`);
  if (context.requestType) parts.push(`نوع الطلب: ${context.requestType.name}`);

  if (context.questions && context.answers) {
    const { block } = buildFactsBlock(context.questions, context.answers);
    parts.push('', 'معلومات المستخدم (لا تتجاوزها):', block);
  }

  parts.push('', 'النص المستهدف:', '<text>', context.text, '</text>');

  return { system, user: parts.join('\n') };
}

// ---------------------------------------------------------------------------
// أسئلة المتابعة
// ---------------------------------------------------------------------------

export interface FollowUpContext {
  instruction: string;
  department: { name: string };
  requestType: { name: string };
  questions: readonly QuestionDef[];
  answers: AnswerMap;
  /** مفاتيح الأسئلة المطروحة مسبقاً — لا يُسأل عنها مجدداً. */
  askedKeys: readonly string[];
}

export function buildFollowUpPrompt(context: FollowUpContext): BuiltPrompt {
  const { block } = buildFactsBlock(context.questions, context.answers);

  return {
    system: [
      { text: CORE_GUARDRAILS, cache: true },
      { text: context.instruction, cache: false },
    ],
    user: [
      `الجهة المخاطَبة: ${context.department.name}`,
      `نوع الطلب: ${context.requestType.name}`,
      '',
      'المعلومات المتوفرة:',
      block,
      '',
      'الأسئلة المطروحة مسبقاً (لا تكررها):',
      context.askedKeys.join('، ') || 'لا يوجد',
      '',
      'حدّد المعلومات الناقصة التي تُقوّي هذا الطلب.',
    ].join('\n'),
  };
}

// ---------------------------------------------------------------------------
// فحص الجودة
// ---------------------------------------------------------------------------

export interface QualityContext {
  instruction: string;
  letterText: string;
  department: { name: string };
  requestType: { name: string };
  questions: readonly QuestionDef[];
  answers: AnswerMap;
}

export function buildQualityPrompt(context: QualityContext): BuiltPrompt {
  const { block } = buildFactsBlock(context.questions, context.answers);

  return {
    system: [
      {
        text: 'أنت مدقّق خطابات رسمية عربية. مهمتك الفحص والإبلاغ فقط — لا تُعدّل النص ولا تكتب بديلاً.',
        cache: true,
      },
      { text: context.instruction, cache: false },
    ],
    user: [
      `الجهة المخاطَبة: ${context.department.name}`,
      `نوع الطلب: ${context.requestType.name}`,
      '',
      'معلومات المستخدم:',
      block,
      '',
      'المعروض المطلوب فحصه:',
      '<letter>',
      escapeForFactBlock(context.letterText),
      '</letter>',
    ].join('\n'),
  };
}
