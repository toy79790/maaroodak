import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { generateLetter } from '@/features/letters/generate-service';
import { RATE_LIMITS } from '@/config/constants';

const schema = z.object({ sessionId: z.string().min(1) });

/**
 * التوليد عملية طويلة (عشرات الثواني) ومكلفة.
 * maxDuration يرفع سقف المهلة على المنصات التي تفرض حداً افتراضياً قصيراً.
 */
export const maxDuration = 120;

export const POST = createHandler(
  {
    body: schema,
    rateLimit: { scope: 'generate', rule: RATE_LIMITS.generate },
  },
  async ({ body }) => {
    const { user } = await assertUser();

    const result = await generateLetter(
      user.id,
      { organizationId: user.organizationId },
      body.sessionId,
    );

    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
