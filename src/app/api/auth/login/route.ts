import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { loginSchema } from '@/features/auth/schema';
import { login } from '@/features/auth/service';
import { RATE_LIMITS } from '@/config/constants';

export const POST = createHandler(
  {
    body: loginSchema,
    rateLimit: {
      scope: 'login',
      rule: RATE_LIMITS.login,
      // المفتاح يجمع الـ IP والبريد: يمنع رشّ كلمات المرور على حساب واحد
      // من عناوين متعددة، ومحاولات متعددة من عنوان واحد على حسابات مختلفة.
      key: (_request, body) => body.email,
    },
  },
  async ({ body, ip, userAgent }) => {
    const result = await login(body, { ip, userAgent });
    if (!result.ok) return jsonError(result.error);
    return jsonOk({ user: result.data });
  },
);
