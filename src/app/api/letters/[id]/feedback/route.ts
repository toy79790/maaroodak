import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { submitFeedback } from '@/features/letters/service';
import { LIMITS } from '@/config/constants';

const schema = z.object({
  rating: z.enum(['THUMBS_UP', 'THUMBS_DOWN']),
  comment: z.string().max(LIMITS.feedbackComment).optional(),
  categories: z.array(z.string().max(40)).max(8).optional(),
});

export async function POST(
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

    const result = await submitFeedback(user.id, id, parsed.data);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  } catch (error) {
    return jsonError(error);
  }
}
