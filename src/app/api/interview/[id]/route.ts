import type { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertSameOrigin } from '@/lib/security/cors';
import { assertUser } from '@/lib/auth/guards';
import { getInterview, abandonInterview } from '@/features/interview/service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const result = await getInterview(
      user.id,
      { organizationId: user.organizationId },
      id,
    );

    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { user } = await assertUser();
    const { id } = await context.params;

    const result = await abandonInterview(user.id, id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  } catch (error) {
    return jsonError(error);
  }
}
