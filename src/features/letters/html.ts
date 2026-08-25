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

/** نص عادي ← HTML فقرات، مع إبراز العلامات النائبة. */
export function textToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return paragraphs
    .map((block) => {
      const escaped = escapeHtml(block)
        // العلامات النائبة تُبرز بصرياً حتى لا تمرّ دون انتباه.
        .replace(
          /\[أدخل\s+([^\]]{1,80})\]/g,
          '<mark class="placeholder">[أدخل $1]</mark>',
        )
        .replace(/\n/g, '<br />');

      return `<p>${escaped}</p>`;
    })
    .join('\n');
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
