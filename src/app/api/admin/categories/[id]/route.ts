import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { categorySchema } from '@/features/admin/schema';
import { deleteCategory, saveCategory } from '@/features/admin/service';

type Params = { id: string };

export const PATCH = createAdminHandler<
  ReturnType<typeof categorySchema.parse>,
  Params
>(
  { permission: 'department:manage', body: categorySchema },
  async ({ body, params, admin }) => {
    const result = await saveCategory(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);

export const DELETE = createAdminHandler<undefined, Params>(
  { permission: 'department:manage' },
  async ({ params, admin }) => {
    const result = await deleteCategory(admin, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
