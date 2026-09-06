import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk, jsonError, zodFieldErrors } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';
import { listVersions, restoreVersion } from '@/features/letters/service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const result = await listVersions(user.id, id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}

const restoreSchema = z.object({ version: z.number().int().positive() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user } = await assertUser();
    const { id } = await context.params;

    const parsed = restoreSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(errors.validation(zodFieldErrors(parsed.error.issues)));
    }

    const result = await restoreVersion(user.id, id, parsed.data.version);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}
