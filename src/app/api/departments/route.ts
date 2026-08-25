import { createHandler } from '@/lib/api/handler';
import { jsonOk } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { listDepartments } from '@/lib/db/repositories/catalog-repository';

export const GET = createHandler(async () => {
  const { user } = await assertUser();
  const departments = await listDepartments({
    organizationId: user.organizationId,
  });
  return jsonOk(departments);
});
