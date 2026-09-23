import { AppError } from '@/lib/api/errors';

/**
 * قراءة جسم JSON — مصدر واحد لكل المسارات (#D-046).
 *
 * `request.json()` المباشر يرمي SyntaxError عند جسم تالف، فيتحوّل إلى
 * INTERNAL (500) ويُسجَّل خطأ خادم — والخطأ خطأ العميل. الجسم الفارغ يُعامل
 * كائناً فارغاً فيردّه مخطط Zod برسالة حقل واضحة.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new AppError('VALIDATION', { message: 'صيغة الطلب غير صالحة.' });
  }
}
