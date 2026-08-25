import { z } from 'zod';
import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { saveSetting } from '@/features/admin/service';
import { listSettings } from '@/lib/db/repositories/settings-repository';

export const GET = createAdminHandler(
  { permission: 'settings:manage' },
  async () => jsonOk(await listSettings()),
);

const schema = z.object({
  key: z.string().min(2).max(80),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const PATCH = createAdminHandler(
  { permission: 'settings:manage', body: schema },
  async ({ body, admin }) => {
    const result = await saveSetting(admin, body.key, body.value);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  },
);
