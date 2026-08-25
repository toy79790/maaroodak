import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { requestTypeSchema } from '@/features/admin/schema';
import { saveRequestType } from '@/features/admin/service';

type Params = { id: string };

export const PATCH = createAdminHandler<
  ReturnType<typeof requestTypeSchema.parse>,
  Params
>(
  { permission: 'requestType:manage', body: requestTypeSchema },
  async ({ body, params, admin }) => {
    const result = await saveRequestType(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
