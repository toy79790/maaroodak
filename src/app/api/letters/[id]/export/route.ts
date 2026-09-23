import type { NextRequest } from 'next/server';
import { jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { getLetter } from '@/features/letters/service';
import { sanitizeHtml } from '@/features/letters/html';
import { buildDocx } from '@/services/export/docx';
import { recordEvent } from '@/services/analytics/analytics-service';

/**
 * تصدير المعروض — مجاني بلا خصم رصيد.
 *
 * `docx` يُبنى على الخادم. `pdf` يتم عبر طباعة المتصفح من صفحة المعاينة
 * (docs/DECISIONS.md #D-008) — تشكيل الحروف العربية يتكفّل به محرك
 * المتصفح، وهو الطريق الوحيد الذي يضمن حروفاً متصلة غير معكوسة.
 */

/** اسم ملف آمن: بلا محارف ممنوعة في أنظمة الملفات، مع حدّ للطول. */
function safeFileName(title: string): string {
  const cleaned = title
    // محارف التحكم (U+0000–U+001F) تُحذف بنقطة الترميز رقمياً لا بنمط يحويها:
    // كانت مكتوبة محارفَ حرفية في الشيفرة فصار Git يرى الملف ثنائياً (CLAUDE.md #2).
    .split('')
    .filter((char) => char.charCodeAt(0) >= 0x20)
    .join('')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  return cleaned || 'معروض';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const format = request.nextUrl.searchParams.get('format') ?? 'docx';
    const result = await getLetter(user.id, id);

    if (!result.ok) return jsonError(result.error);

    const letter = result.data;
    const fileName = safeFileName(letter.title);

    if (format === 'docx') {
      const buffer = await buildDocx({
        title: letter.title,
        contentHtml: letter.contentHtml,
      });

      await recordEvent('letter_exported', {
        userId: user.id,
        props: { letterId: id, format: 'docx' },
      });

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          // RFC 5987 — يحفظ الاسم العربي في كل المتصفحات.
          'Content-Disposition': `attachment; filename="letter.docx"; filename*=UTF-8''${encodeURIComponent(`${fileName}.docx`)}`,
          'Content-Length': String(buffer.byteLength),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    if (format === 'html') {
      await recordEvent('letter_exported', {
        userId: user.id,
        props: { letterId: id, format: 'html' },
      });

      // تعقيم عند الإخراج أيضاً لا عند الحفظ وحده — لا نثق بما في القاعدة
      // (docs/SECURITY.md §7 · #D-046). الملف يُفتح خارج حماية التطبيق كلها.
      return new Response(sanitizeHtml(letter.contentHtml), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${fileName}.html`)}`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    return jsonError(
      errors.validation(
        { format: 'الصيغ المدعومة: docx أو html. لملف PDF استخدم زر الطباعة.' },
        'صيغة غير مدعومة.',
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
