import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { changePasswordSchema } from '@/features/auth/schema';
import { changePassword } from '@/features/auth/service';

export const POST = createHandler(
  { body: changePasswordSchema },
  async ({ body }) => {
    const { user, sessionId } = await assertUser();
    const result = await changePassword(user.id, sessionId, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
