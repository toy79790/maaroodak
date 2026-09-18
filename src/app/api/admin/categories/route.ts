import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { categorySchema } from '@/features/admin/schema';
import { saveCategory } from '@/features/admin/service';
import { listCategoriesAdmin } from '@/features/admin/queries';

export const GET = createAdminHandler(
  { permission: 'department:manage' },
  async () => jsonOk(await listCategoriesAdmin()),
);

export const POST = createAdminHandler(
  { permission: 'department:manage', body: categorySchema },
  async ({ body, admin }) => {
    const result = await saveCategory(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
