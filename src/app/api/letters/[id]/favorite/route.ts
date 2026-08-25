import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { setFavorite } from '@/features/letters/service';

const schema = z.object({ value: z.boolean() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(errors.validation(zodFieldErrors(parsed.error.issues)));
    }

    const result = await setFavorite(user.id, id, parsed.data.value);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}
