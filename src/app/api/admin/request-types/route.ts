import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { requestTypeSchema } from '@/features/admin/schema';
import { saveRequestType } from '@/features/admin/service';
import { listRequestTypesAdmin } from '@/features/admin/queries';

export const GET = createAdminHandler(
  { permission: 'requestType:manage' },
  async () => jsonOk(await listRequestTypesAdmin()),
);

export const POST = createAdminHandler(
  { permission: 'requestType:manage', body: requestTypeSchema },
  async ({ body, admin }) => {
    const result = await saveRequestType(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
