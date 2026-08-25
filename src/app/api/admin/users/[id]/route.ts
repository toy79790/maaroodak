import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { userUpdateSchema } from '@/features/admin/schema';
import { updateUser } from '@/features/admin/service';

type Params = { id: string };

export const PATCH = createAdminHandler<
  ReturnType<typeof userUpdateSchema.parse>,
  Params
>(
  // تعديل المستخدمين صلاحية أعلى من قراءتهم.
  { permission: 'user:manage', body: userUpdateSchema },
  async ({ body, params, admin }) => {
    const result = await updateUser(admin, params.id, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
