import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { rateLimit } from '@/lib/security/rate-limit';
import { RATE_LIMITS } from '@/config/constants';
import { getSettings } from '@/lib/db/repositories/settings-repository';
import { AI_TOOLS, runAiTool } from '@/features/letters/ai-tools-service';

const schema = z.object({
  tool: z.enum(AI_TOOLS),
  selection: z.string().max(20000).nullable().optional(),
});

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user } = await assertUser();
    const { id } = await context.params;

    // الحدّ من الإعدادات لا من الثابت: اللوحة تعرضه ويجب أن يسري (#D-044).
    const { limitAiToolPerWindow } = await getSettings();
    const limit = await rateLimit('ai-tool', user.id, {
      limit: limitAiToolPerWindow,
      windowMs: RATE_LIMITS.aiTool.windowMs,
    });
    if (!limit.allowed) return jsonError(errors.rateLimited(limit.retryAfter));

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(errors.validation(zodFieldErrors(parsed.error.issues)));
    }

    const result = await runAiTool(
      user.id,
      { organizationId: user.organizationId },
      id,
      parsed.data,
    );

    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}
