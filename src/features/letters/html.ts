/**
 * تحويل وتعقيم محتوى المعروض — docs/SECURITY.md §7
 *
 * محتوى المعروض HTML قابل للتحرير من المستخدم، وهو أخطر سطح في التطبيق.
 * التعقيم يجري **عند الحفظ وعند العرض** معاً (دفاع عميق): لا نثق بما في
 * القاعدة، لأن سجلاً قديماً أو استيراداً أو خللاً قد يُدخل محتوى غير معقّم.
 *
 * قائمة سماح صارمة — كل ما عداها يُحذف. لا نُحاول «تنظيف» ما هو خطير:
 * القائمة السوداء تُلتف عليها دائماً.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote',
  'span', 'div',
  'mark',
]);

/** السمات المسموحة لكل وسم. `style` مقيّدة بالمحاذاة فقط. */
const ALLOWED_ATTRIBUTES: Record<string, ReadonlySet<string>> = {
  '*': new Set(['dir', 'class']),
  span: new Set(['dir', 'class', 'style']),
  p: new Set(['dir', 'class', 'style']),
  div: new Set(['dir', 'class', 'style']),
  h1: new Set(['dir', 'class', 'style']),
  h2: new Set(['dir', 'class', 'style']),
  h3: new Set(['dir', 'class', 'style']),
  mark: new Set(['class']),
};

/** قيم `style` المسموحة — محاذاة النص فقط، لا شيء آخر. */
const ALLOWED_STYLE = /^text-align:\s*(right|left|center|justify);?$/i;

/** أصناف CSS المسموحة — المستخدمة في ورقة المعروض. */
const ALLOWED_CLASSES = new Set(['placeholder', 'placeholder-mark']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * تعقيم HTML بقائمة سماح.
 *
 * تنفيذ بلا اعتماد على DOM حتى يعمل على الخادم وفي الاختبارات بلا jsdom.
 * يعمل بالمرور على الوسوم: ما ليس في القائمة يُحذف وسماً ويُبقى محتواه نصاً.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  let output = input;

  // 1) حذف العناصر الخطرة بمحتواها كاملاً.
  output = output.replace(
    /<(script|style|iframe|object|embed|form|input|button|link|meta|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  // نسخة الوسم المفرد (بلا إغلاق).
  output = output.replace(
    /<(script|style|iframe|object|embed|form|input|button|link|meta)\b[^>]*\/?>/gi,
    '',
  );

  // 2) حذف التعليقات (قد تُخفي حمولات).
  output = output.replace(/<!--[\s\S]*?-->/g, '');

  // 3) المرور على كل وسم متبقٍّ.
  output = output.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (match, rawName: string, rawAttributes: string) => {
      const tag = rawName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) return '';

      if (match.startsWith('</')) return `</${tag}>`;

      const allowed =
        ALLOWED_ATTRIBUTES[tag] ?? ALLOWED_ATTRIBUTES['*'] ?? new Set<string>();

      const attributes: string[] = [];

      for (const attribute of rawAttributes.matchAll(
        /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
      )) {
        const name = (attribute[1] ?? '').toLowerCase();
        const value = attribute[2] ?? attribute[3] ?? '';

        // كل سمات on* محذوفة مهما كان الوسم.
        if (name.startsWith('on')) continue;
        if (!allowed.has(name)) continue;

        if (name === 'style') {
          if (!ALLOWED_STYLE.test(value.trim())) continue;
        }

        if (name === 'class') {
          const classes = value
            .split(/\s+/)
            .filter((item) => ALLOWED_CLASSES.has(item));
          if (classes.length === 0) continue;
          attributes.push(`class="${escapeHtml(classes.join(' '))}"`);
          continue;
        }

        if (name === 'dir' && !['rtl', 'ltr', 'auto'].includes(value.toLowerCase())) {
          continue;
        }

        attributes.push(`${name}="${escapeHtml(value)}"`);
      }

      const selfClosing = tag === 'br' ? ' /' : '';
      return `<${tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}${selfClosing}>`;
    },
  );

  return output.trim();
}

/** نص ← HTML سطري: هروب، وإبراز العلامات النائبة، و`<br />` لكل سطر. */
function inlineTextToHtml(text: string): string {
  return (
    escapeHtml(text)
      // العلامات النائبة تُبرز بصرياً حتى لا تمرّ دون انتباه.
      .replace(
        /\[أدخل\s+([^\]]{1,80})\]/g,
        '<mark class="placeholder">[أدخل $1]</mark>',
      )
      .replace(/\n/g, '<br />')
  );
}

/** نص عادي ← HTML فقرات، مع إبراز العلامات النائبة. */
export function textToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return paragraphs.map((block) => `<p>${inlineTextToHtml(block)}</p>`).join('\n');
}

// ---------------------------------------------------------------------------
// استبدال نص داخل HTML دون المساس بتنسيقه
// ---------------------------------------------------------------------------

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'div']);

/** وحدة نصية: محرف واحد أو كيان HTML واحد، بشكلها الخام وقيمتها. */
interface TextUnit {
  raw: string;
  char: string;
}

type Token =
  | { kind: 'tag'; raw: string; name: string; closing: boolean }
  | { kind: 'text'; units: TextUnit[] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntity(raw: string): string {
  if (!raw.startsWith('&') || raw.length === 1) return raw;
  const body = raw.slice(1, -1).toLowerCase();

  if (body.startsWith('#')) {
    const code = body.startsWith('#x')
      ? parseInt(body.slice(2), 16)
      : parseInt(body.slice(1), 10);
    // `fromCodePoint` يرمي خارج مدى يونيكود: كيان مثل `&#99999999;` في محتوى
    // مخزَّن كان يُسقط الأداة بـ 500. يبقى كما هو نصاً خاماً.
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : raw;
  }

  return NAMED_ENTITIES[body] ?? raw;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];

  for (const part of html.split(/(<[^>]*>)/)) {
    if (!part) continue;

    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
    if (tag) {
      tokens.push({
        kind: 'tag',
        raw: part,
        name: (tag[2] ?? '').toLowerCase(),
        closing: tag[1] === '/',
      });
      continue;
    }

    const units = [...part.matchAll(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);|[\s\S]/giu)].map(
      (match) => ({ raw: match[0], char: decodeEntity(match[0]) }),
    );
    tokens.push({ kind: 'text', units });
  }

  return tokens;
}

/**
 * يستبدل أول ظهور لـ`target` في HTML بـ`replacement`، ويُبقي كل وسم كما هو.
 *
 * لماذا لا `contentText.replace` ثم `textToHtml`؟ لأن ذلك يعيد بناء المعروض
 * كله من نص مسطّح: تحسين جملة واحدة كان يمسح العناوين والقوائم والمحاذاة من
 * الوثيقة بأكملها. ولأن التحديد يأتي من المحرر بسطر واحد بين الفقرات والنص
 * المخزّن بسطرين، فكان أي تحديد يمتد على فقرتين لا يُطابَق أبداً (#D-045).
 *
 * المطابقة تتجاهل المسافات كلها، فلا يهمّ كيف فصل المحرر الفقرات. النص
 * المحذوف يُزال والوسوم تبقى، فيبقى الـ HTML متوازناً، ويرث البديل تنسيق
 * موضع بدايته. الكتل التي تبدأ داخل التحديد وتفرغ تماماً تُحذف.
 *
 * يُرجع null إن لم يوجد النص — لا استبدال تقريبياً.
 */
export function replaceTextInHtml(
  html: string,
  target: string,
  replacement: string,
): string | null {
  const needle = target.replace(/\s+/g, '');
  if (!needle) return null;

  const tokens = tokenize(html);

  // سلسلة المحارف غير الفارغة مع موضع كل محرف (رمز، وحدة).
  let stream = '';
  const positions: Array<{ t: number; u: number }> = [];

  tokens.forEach((token, t) => {
    if (token.kind !== 'text') return;
    token.units.forEach((unit, u) => {
      if (/^\s+$/u.test(unit.char)) return;
      stream += unit.char;
      for (let i = 0; i < unit.char.length; i++) positions.push({ t, u });
    });
  });

  const index = stream.indexOf(needle);
  if (index === -1) return null;

  const start = positions[index];
  const end = positions[index + needle.length - 1];
  if (!start || !end) return null;

  // 1) حذف النص وفواصل الأسطر داخل النطاق، مع إبقاء الوسوم.
  const removed = new Set<number>();

  for (let t = start.t; t <= end.t; t++) {
    const token = tokens[t];
    if (!token) continue;

    if (token.kind === 'tag') {
      if (token.name === 'br') removed.add(t);
      continue;
    }

    const from = t === start.t ? start.u : 0;
    const to = t === end.t ? end.u : token.units.length - 1;
    token.units = [...token.units.slice(0, from), ...token.units.slice(to + 1)];
  }

  // 2) البديل في موضع البداية — داخل السياق السطري نفسه.
  const startToken = tokens[start.t];
  if (startToken?.kind === 'text') {
    startToken.units.splice(start.u, 0, {
      raw: inlineTextToHtml(replacement.trim().replace(/\n{3,}/g, '\n\n')),
      char: replacement,
    });
  }

  // 3) الكتل التي بدأت داخل النطاق وفرغت تماماً تُحذف (بما فيها الكتل الأب).
  const stack: number[] = [];
  const closeOf = new Map<number, number>();
  tokens.forEach((token, t) => {
    if (token.kind !== 'tag' || !BLOCK_TAGS.has(token.name)) return;
    if (!token.closing) stack.push(t);
    else {
      const open = stack.pop();
      if (open !== undefined) closeOf.set(open, t);
    }
  });

  const hasContent = (from: number, to: number) => {
    for (let t = from + 1; t < to; t++) {
      if (removed.has(t)) continue;
      const token = tokens[t];
      if (!token) continue;
      if (token.kind === 'tag' && token.name === 'br') return true;
      if (token.kind === 'text' && token.units.some((unit) => !/^\s+$/u.test(unit.char))) {
        return true;
      }
    }
    return false;
  };

  for (const [open, close] of [...closeOf.entries()].sort((a, b) => a[0] - b[0])) {
    if (open <= start.t || open >= end.t || removed.has(open)) continue;
    if (hasContent(open, close)) continue;
    for (let t = open; t <= close; t++) removed.add(t);
  }

  return tokens
    .map((token, t) => {
      if (removed.has(t)) return '';
      return token.kind === 'tag' ? token.raw : token.units.map((unit) => unit.raw).join('');
    })
    .join('');
}

/** HTML ← نص عادي (للبحث والتصدير و DOCX). */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-3]|li|blockquote|div)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** عدد كلمات محتوى HTML — للإحصاءات وفحوص الطول. */
export function htmlWordCount(html: string): number {
  return htmlToText(html)
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
