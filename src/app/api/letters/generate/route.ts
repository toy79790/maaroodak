import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { rateLimit } from '@/lib/security/rate-limit';
import { generateLetter } from '@/features/letters/generate-service';
import { RATE_LIMITS } from '@/config/constants';
import { getSettings } from '@/lib/db/repositories/settings-repository';

const schema = z.object({ sessionId: z.string().min(1) });

/**
 * التوليد عملية طويلة (عشرات الثواني) ومكلفة.
 * maxDuration يرفع سقف المهلة على المنصات التي تفرض حداً افتراضياً قصيراً.
 */
export const maxDuration = 120;

export const POST = createHandler(
  { body: schema },
  async ({ body }) => {
    const { user } = await assertUser();

    /*
     * الحدّ داخل المعالِج لا في خيارات `createHandler` — لسببين (#D-044):
     *
     *  1. قيمته تأتي من الإعدادات، وخيارات المصنع تُقرأ مرة عند التحميل.
     *  2. المفتاح صار معرّف المستخدم بدل الـ IP. مسار مُصادَق عليه، ومشغّلو
     *     الجوال في السعودية يشاركون عنواناً واحداً بين آلاف المشتركين —
     *     فالمفتاح بالـ IP كان يحجب مستخدمين أبرياء ويترك المهاجم يدور
     *     على العناوين.
     */
    const { limitGeneratePerWindow } = await getSettings();
    const limit = await rateLimit('generate', user.id, {
      limit: limitGeneratePerWindow,
      windowMs: RATE_LIMITS.generate.windowMs,
    });

    if (!limit.allowed) return jsonError(errors.rateLimited(limit.retryAfter));

    const result = await generateLetter(
      user.id,
      { organizationId: user.organizationId },
      body.sessionId,
    );

    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
