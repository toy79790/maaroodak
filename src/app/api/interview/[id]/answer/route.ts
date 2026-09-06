import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { submitAnswers } from '@/features/interview/service';

const schema = z.object({
  // القيم تُتحقق ديناميكياً حسب تعريف كل سؤال داخل الخدمة.
  answers: z.record(z.string(), z.unknown()),
  advance: z.boolean().optional().default(true),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user } = await assertUser();
    const { id } = await context.params;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(errors.validation(zodFieldErrors(parsed.error.issues)));
    }

    const result = await submitAnswers(
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
