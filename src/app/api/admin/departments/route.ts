import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { departmentSchema } from '@/features/admin/schema';
import { saveDepartment } from '@/features/admin/service';
import { listDepartmentsAdmin } from '@/features/admin/queries';

export const GET = createAdminHandler(
  { permission: 'department:manage' },
  async () => jsonOk(await listDepartmentsAdmin()),
);

export const POST = createAdminHandler(
  { permission: 'department:manage', body: departmentSchema },
  async ({ body, admin }) => {
    const result = await saveDepartment(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
