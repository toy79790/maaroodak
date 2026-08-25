import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { registerSchema } from '@/features/auth/schema';
import { register } from '@/features/auth/service';
import { RATE_LIMITS } from '@/config/constants';

export const POST = createHandler(
  {
    body: registerSchema,
    rateLimit: { scope: 'register', rule: RATE_LIMITS.register },
  },
  async ({ body, ip, userAgent }) => {
    const result = await register(body, { ip, userAgent });
    if (!result.ok) return jsonError(result.error);
    return jsonOk({ user: result.data }, { status: 201 });
  },
);
