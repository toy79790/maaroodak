import type { NextRequest } from 'next/server';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { listRequestTypesForDepartment } from '@/lib/db/repositories/catalog-repository';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await assertUser();
    const { id } = await context.params;

    const requestTypes = await listRequestTypesForDepartment(
      { organizationId: user.organizationId },
      id,
    );

    return jsonOk(requestTypes);
  } catch (error) {
    return jsonError(error);
  }
}
