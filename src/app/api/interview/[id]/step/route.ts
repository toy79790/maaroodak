import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/request';
import { goToStep } from '@/features/interview/service';

const schema = z.object({ step: z.number().int().min(0) });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user } = await assertUser();
    const { id } = await context.params;

    const parsed = schema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return jsonError(errors.validation(zodFieldErrors(parsed.error.issues)));
    }

    const result = await goToStep(
      user.id,
      { organizationId: user.organizationId },
      id,
      parsed.data.step,
    );

    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}
