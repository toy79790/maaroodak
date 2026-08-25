import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { forgotPasswordSchema } from '@/features/auth/schema';
import { forgotPassword } from '@/features/auth/service';
import { RATE_LIMITS } from '@/config/constants';

export const POST = createHandler(
  {
    body: forgotPasswordSchema,
    rateLimit: {
      scope: 'forgot-password',
      rule: RATE_LIMITS.forgotPassword,
      key: (_request, body) => body.email,
    },
  },
  async ({ body }) => {
    const result = await forgotPassword(body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
