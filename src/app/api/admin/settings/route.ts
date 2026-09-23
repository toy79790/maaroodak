import { z } from 'zod';
import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { saveSetting } from '@/features/admin/service';
import { listSettings } from '@/lib/db/repositories/settings-repository';
import { isSettingKey, parseSetting, requiredPermissionFor } from '@/config/settings-schema';
import { assertPermission } from '@/lib/auth/guards';
import { errors } from '@/lib/api/errors';

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
    // المفتاح والقيمة يُتحقَّق منهما معاً: حدود الواجهة لا تحرس الـ API (#D-044).
    const setting = parseSetting(body.key, body.value);
    if (!setting.ok) {
      return jsonError(errors.validation({ value: setting.message }));
    }

    // إعدادات الرصيد صلاحية أعلى من `settings:manage` — #D-048.
    if (isSettingKey(body.key)) {
      await assertPermission(requiredPermissionFor(body.key));
    }

    const result = await saveSetting(admin, body.key, setting.value);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  },
);
