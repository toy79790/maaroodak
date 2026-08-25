/**
 * محرك القوالب — docs/ARCHITECTURE.md §6 · docs/DECISIONS.md #D-007
 *
 * يدعم شيئين فقط:
 *   {{variable}}              استبدال
 *   {{#if variable}}…{{/if}}  كتلة شرطية (مع {{else}} اختياري)
 *
 * لا يُنفّذ أي كود ولا يستدعي دوال مساعدة. السبب أمني: القوالب يكتبها
 * مسؤول المنصة من لوحة التحكم، ومحرك كامل الميزات (Handlebars) يعني منح
 * كاتب القالب قدرةً على التنفيذ داخل الخادم.
 *
 * دالة نقية بلا اعتماد على أي إطار — قابلة للاختبار بالكامل.
 */

export type TemplateValue = string | number | boolean | null | undefined;
export type TemplateContext = Record<string, TemplateValue>;

export interface RenderOptions {
  /**
   * ما يُوضع مكان متغيّر غير معرّف.
   * `'placeholder'` (الافتراضي) يُبقي أثراً مرئياً `[أدخل ...]` حتى لا
   * تمرّ معلومة ناقصة دون أن ينتبه المستخدم.
   * `'empty'` يحذفه — يُستخدم للكتل الاختيارية.
   */
  missing?: 'placeholder' | 'empty' | 'keep';
}

export interface RenderResult {
  output: string;
  /** المتغيرات المستخدمة في القالب. */
  used: string[];
  /** المتغيرات المطلوبة وغير المتوفرة في السياق. */
  missing: string[];
}

/** أسماء المتغيرات: حروف وأرقام وشرطة سفلية ونقطة (لـ `a.question_key`). */
const VARIABLE_NAME = '[A-Za-z_][A-Za-z0-9_.]*';

/**
 * كتلة شرطية **لا تحتوي كتلة أخرى بداخلها** (`(?!\{\{#if\s)` في الجسم).
 *
 * الحل من الداخل إلى الخارج مقصود: نمط غير جشع بسيط يلتقط أول `{{/if}}`
 * يصادفه، وهي في حالة التداخل تخصّ الكتلة الداخلية لا الخارجية — فينتج
 * `{{/if}}` يتيمة في المخرَج. حصر الجسم بما لا يحوي `{{#if` يجعل كل مرور
 * يحلّ الطبقة الأعمق، فتصبح التي تليها هي الأعمق في المرور التالي.
 */
const IF_BLOCK = new RegExp(
  `\\{\\{#if\\s+(${VARIABLE_NAME})\\s*\\}\\}((?:(?!\\{\\{#if\\s)[\\s\\S])*?)\\{\\{\\/if\\}\\}`,
  'g',
);

/** نمط فضفاض لاستخراج الأسماء فقط (لا يُستخدم في الرندر). */
const IF_BLOCK_LOOSE = new RegExp(`\\{\\{#if\\s+(${VARIABLE_NAME})\\s*\\}\\}`, 'g');

const ELSE_SPLIT = /\{\{else\}\}/;

const VARIABLE = new RegExp(`\\{\\{\\s*(${VARIABLE_NAME})\\s*\\}\\}`, 'g');

/** قيمة تُعدّ «موجودة» في الكتل الشرطية. `false` و`0` و`''` لا تُعدّ. */
function isTruthy(value: TemplateValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value.trim().length > 0;
}

function toText(value: TemplateValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  return String(value);
}

/**
 * علامة نائبة مرئية لمعلومة ناقصة.
 * الصيغة نفسها التي يستخدمها الذكاء الاصطناعي، ليكشفها فحص واحد.
 */
function placeholderFor(name: string): string {
  return `[أدخل ${name.replace(/^a\./, '').replace(/_/g, ' ')}]`;
}

export function render(
  template: string,
  context: TemplateContext,
  options: RenderOptions = {},
): RenderResult {
  const missingMode = options.missing ?? 'placeholder';
  const used = new Set<string>();
  const missing = new Set<string>();

  // 1) الكتل الشرطية أولاً — قد تحذف متغيرات فلا تُحتسب ناقصة.
  //    التكرار يعالج التداخل: كل مرور يحلّ الطبقة الأعمق (انظر IF_BLOCK).
  let output = template;
  let previous = '';
  let passes = 0;

  while (output !== previous && passes < 20) {
    previous = output;
    passes += 1;

    output = output.replace(IF_BLOCK, (_match, name: string, body: string) => {
      used.add(name);
      const [whenTrue = '', whenFalse = ''] = body.split(ELSE_SPLIT);
      return isTruthy(context[name]) ? whenTrue : whenFalse;
    });
  }

  // 2) استبدال المتغيرات.
  output = output.replace(VARIABLE, (match, name: string) => {
    used.add(name);
    const value = context[name];

    if (!isTruthy(value)) {
      missing.add(name);
      if (missingMode === 'empty') return '';
      if (missingMode === 'keep') return match;
      return placeholderFor(name);
    }

    return toText(value);
  });

  // 3) تنظيف الأسطر الفارغة الناتجة عن كتل محذوفة.
  output = output
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    output,
    used: [...used].sort(),
    missing: [...missing].sort(),
  };
}

/** أسماء كل المتغيرات المستخدمة في قالب — لواجهة بناء القوالب في الإدارة. */
export function extractVariables(template: string): string[] {
  const names = new Set<string>();

  for (const match of template.matchAll(VARIABLE)) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of template.matchAll(IF_BLOCK_LOOSE)) {
    if (match[1]) names.add(match[1]);
  }

  return [...names].sort();
}

export interface TemplateIssue {
  type: 'unclosed_if' | 'unopened_if' | 'unknown_variable' | 'missing_ai_slot';
  message: string;
}

/**
 * فحص القالب قبل الحفظ من لوحة التحكم.
 * قالب تالف يُنتج معاريض تالفة لكل مستخدمي هذه الجهة — الفحص هنا أرخص
 * بكثير من اكتشافه في مخرجات المستخدمين.
 */
export function validateTemplate(
  template: string,
  knownVariables: readonly string[] = [],
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];

  const openCount = (template.match(/\{\{#if\s/g) ?? []).length;
  const closeCount = (template.match(/\{\{\/if\}\}/g) ?? []).length;

  if (openCount > closeCount) {
    issues.push({
      type: 'unclosed_if',
      message: `كتلة شرطية غير مغلقة: عدد {{#if}} أكبر من {{/if}} بـ ${openCount - closeCount}.`,
    });
  }
  if (closeCount > openCount) {
    issues.push({
      type: 'unopened_if',
      message: `{{/if}} بلا {{#if}} مقابل: زائدة بـ ${closeCount - openCount}.`,
    });
  }

  if (!template.includes('{{ai_body}}')) {
    issues.push({
      type: 'missing_ai_slot',
      message:
        'القالب لا يحتوي {{ai_body}} — لن يظهر المحتوى المُولَّد في المعروض.',
    });
  }

  if (knownVariables.length > 0) {
    const known = new Set(knownVariables);
    for (const name of extractVariables(template)) {
      // متغيرات الإجابات (a.*) لا يمكن التحقق منها هنا: تعتمد على الجهة والنوع.
      if (name.startsWith('a.')) continue;
      if (!known.has(name)) {
        issues.push({
          type: 'unknown_variable',
          message: `متغيّر غير معروف: {{${name}}}`,
        });
      }
    }
  }

  return issues;
}
