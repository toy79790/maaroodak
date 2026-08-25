import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { resetPasswordSchema } from '@/features/auth/schema';
import { resetPassword } from '@/features/auth/service';
import { RATE_LIMITS } from '@/config/constants';

export const POST = createHandler(
  {
    body: resetPasswordSchema,
    rateLimit: { scope: 'reset-password', rule: RATE_LIMITS.forgotPassword },
  },
  async ({ body }) => {
    const result = await resetPassword(body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  },
);
