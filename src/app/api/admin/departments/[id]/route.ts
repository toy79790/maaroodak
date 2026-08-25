import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { departmentSchema } from '@/features/admin/schema';
import { deleteDepartment, saveDepartment } from '@/features/admin/service';

type Params = { id: string };

export const PATCH = createAdminHandler<
  ReturnType<typeof departmentSchema.parse>,
  Params
>(
  { permission: 'department:manage', body: departmentSchema },
  async ({ body, params, admin }) => {
    const result = await saveDepartment(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);

export const DELETE = createAdminHandler<undefined, Params>(
  { permission: 'department:manage' },
  async ({ params, admin }) => {
    const result = await deleteDepartment(admin, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  },
);
