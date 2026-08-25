import type { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { goBack } from '@/features/interview/service';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const result = await goBack(
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
