import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { AI_DISCLAIMER, site } from '@/config/site';

/**
 * تصدير DOCX عربي — docs/DECISIONS.md #D-009
 *
 * ثلاثة إعدادات لازمة لعربية صحيحة في Word، وإغفال أيٍّ منها يُنتج ملفاً
 * يبدو مكسوراً:
 *   1. `bidirectional: true` على الفقرة  — يجعل اتجاه الفقرة RTL.
 *   2. `rightToLeft: true` على النص      — يضبط اتجاه المقطع.
 *   3. `alignment: RIGHT`                — المحاذاة البصرية.
 *
 * البديل الشائع (توليد HTML بامتداد .doc) يُنتج ملفاً يرفضه Word الحديث
 * أو يفتحه بترميز خاطئ.
 */

const ARABIC_FONT = 'Traditional Arabic';
const FALLBACK_FONT = 'Arial';

/** مقاسات Word بالنقاط × 2 (نصف نقطة). */
const SIZE = {
  body: 28, // 14pt
  heading: 32, // 16pt
  small: 20, // 10pt
} as const;

interface DocxBlock {
  type: 'paragraph' | 'heading' | 'listItem';
  text: string;
  bold?: boolean;
  center?: boolean;
}

/**
 * تحويل HTML المعروض إلى كتل بسيطة.
 * محتوى المعروض بنية بسيطة (فقرات، عناوين، قوائم)، فمحلّل خفيف أدق من
 * محاولة تحويل HTML عام.
 */
export function htmlToBlocks(html: string): DocxBlock[] {
  const blocks: DocxBlock[] = [];

  const pattern = /<(h[1-3]|p|li|blockquote)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(pattern)) {
    const tag = (match[1] ?? '').toLowerCase();
    const attributes = match[2] ?? '';
    const inner = match[3] ?? '';

    const text = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (text.length === 0) continue;

    const center = /text-align:\s*center/i.test(attributes);

    if (tag.startsWith('h')) {
      blocks.push({ type: 'heading', text, bold: true, center });
    } else if (tag === 'li') {
      blocks.push({ type: 'listItem', text });
    } else {
      blocks.push({ type: 'paragraph', text, center });
    }
  }

  // احتياط: محتوى بلا وسوم كتلية.
  if (blocks.length === 0) {
    const plain = html.replace(/<[^>]+>/g, '').trim();
    if (plain) blocks.push({ type: 'paragraph', text: plain });
  }

  return blocks;
}

function runsFor(text: string, options: { bold?: boolean; size?: number } = {}) {
  // الأسطر داخل الفقرة الواحدة تصبح فواصل أسطر لا فقرات جديدة.
  return text.split('\n').map(
    (line, index) =>
      new TextRun({
        text: line,
        bold: options.bold ?? false,
        size: options.size ?? SIZE.body,
        font: { name: ARABIC_FONT, hint: 'cs' },
        // ⚠️ لازم لعربية صحيحة الاتجاه داخل المقطع.
        rightToLeft: true,
        ...(index > 0 ? { break: 1 } : {}),
      }),
  );
}

function toParagraph(block: DocxBlock): Paragraph {
  const common = {
    // ⚠️ لازم — بدونه تُعرض الفقرة بترتيب معكوس للكلمات في بعض الإصدارات.
    bidirectional: true,
    alignment: block.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
  };

  if (block.type === 'heading') {
    return new Paragraph({
      ...common,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 160 },
      children: runsFor(block.text, { bold: true, size: SIZE.heading }),
    });
  }

  if (block.type === 'listItem') {
    return new Paragraph({
      ...common,
      bullet: { level: 0 },
      spacing: { after: 80, line: 360 },
      children: runsFor(block.text),
    });
  }

  return new Paragraph({
    ...common,
    spacing: { after: 200, line: 400 },
    children: runsFor(block.text),
  });
}

export interface DocxInput {
  title: string;
  contentHtml: string;
  /** يُذيَّل به المستند — متطلب في docs/AI_SYSTEM.md §13 */
  includeDisclaimer?: boolean;
}

export async function buildDocx(input: DocxInput): Promise<Buffer> {
  const blocks = htmlToBlocks(input.contentHtml);

  const children: Paragraph[] = blocks.map(toParagraph);

  if (input.includeDisclaimer !== false) {
    children.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 600 },
        border: {
          top: { style: 'single', size: 4, color: 'CCCCCC', space: 8 },
        },
        children: [
          new TextRun({
            text: AI_DISCLAIMER,
            size: SIZE.small,
            color: '666666',
            font: { name: ARABIC_FONT, hint: 'cs' },
            rightToLeft: true,
          }),
        ],
      }),
    );
  }

  const document = new Document({
    creator: site.name,
    title: input.title,
    description: 'خطاب رسمي',
    styles: {
      default: {
        document: {
          run: { font: { name: ARABIC_FONT, hint: 'cs' }, size: SIZE.body },
          paragraph: { spacing: { line: 400 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // A4 بوحدة twip (1 بوصة = 1440)
            size: { width: 11906, height: 16838 },
            margin: {
              top: 1417, // 2.5 سم
              bottom: 1417,
              left: 1247, // 2.2 سم
              right: 1247,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

export { FALLBACK_FONT };
