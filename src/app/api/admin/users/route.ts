import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk } from '@/lib/api/response';
import { listUsersAdmin } from '@/features/admin/queries';

export const GET = createAdminHandler(
  { permission: 'user:read' },
  async ({ request }) =>
    jsonOk(await listUsersAdmin(request.nextUrl.searchParams.get('q') ?? undefined)),
);
