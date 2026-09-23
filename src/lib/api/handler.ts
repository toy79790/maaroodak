import 'server-only';

import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, zodFieldErrors } from '@/lib/api/response';
import { readJsonBody } from '@/lib/api/request';
import { errors } from '@/lib/api/errors';
import { clientIp, rateLimit, type RateLimitRule } from '@/lib/security/rate-limit';
import { assertSameOrigin } from '@/lib/security/cors';
import { events } from '@/lib/logging/logger';

/**
 * غلاف موحّد لمسارات الـ API — docs/ARCHITECTURE.md §2
 *
 * يضمن أن كل مسار يمرّ بنفس التسلسل: فحص Origin ← تحديد المعدّل ← التحقق
 * ← المعالجة ← تحويل أي استثناء إلى استجابة آمنة. غيابه يعني أن كل مسار
 * يعيد تنفيذ هذه الخطوات، ونسيان واحدة منها يمرّ بلا أن يُلاحَظ.
 */

export interface HandlerOptions<TBody> {
  /** مخطط جسم الطلب — يُقرأ ويُتحقق تلقائياً. */
  body?: z.ZodType<TBody>;
  /** تحديد معدّل قبل تنفيذ المعالج. */
  rateLimit?: {
    scope: string;
    rule: RateLimitRule;
    /** مفتاح إضافي غير الـ IP (مثل البريد أو معرّف المستخدم). */
    key?: (request: NextRequest, body: TBody) => string | Promise<string>;
  };
}

export interface HandlerContext<TBody> {
  request: NextRequest;
  body: TBody;
  ip: string;
  userAgent: string;
}

type Handler<TBody> = (
  ctx: HandlerContext<TBody>,
) => Promise<NextResponse> | NextResponse;

export function createHandler<TBody = undefined>(
  options: HandlerOptions<TBody>,
  handler: Handler<TBody>,
): (request: NextRequest) => Promise<NextResponse>;
export function createHandler(
  handler: Handler<undefined>,
): (request: NextRequest) => Promise<NextResponse>;
export function createHandler<TBody>(
  optionsOrHandler: HandlerOptions<TBody> | Handler<undefined>,
  maybeHandler?: Handler<TBody>,
): (request: NextRequest) => Promise<NextResponse> {
  const options: HandlerOptions<TBody> =
    typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
  const handler = (
    typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler
  ) as Handler<TBody>;

  return async (request: NextRequest) => {
    try {
      assertSameOrigin(request);

      let body = undefined as TBody;

      if (options.body) {
        const raw = await readJsonBody(request);
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          throw errors.validation(zodFieldErrors(parsed.error.issues));
        }
        body = parsed.data;
      }

      const ip = clientIp(request.headers);

      if (options.rateLimit) {
        const extra = options.rateLimit.key
          ? await options.rateLimit.key(request, body)
          : '';
        const identifier = extra ? `${ip}|${extra}` : ip;
        const result = await rateLimit(
          options.rateLimit.scope,
          identifier,
          options.rateLimit.rule,
        );
        if (!result.allowed) {
          events.rateLimited(options.rateLimit.scope, identifier);
          throw errors.rateLimited(result.retryAfter);
        }
      }

      return await handler({
        request,
        body,
        ip,
        userAgent: request.headers.get('user-agent') ?? '',
      });
    } catch (thrown) {
      // NEXT_REDIRECT وما شابهه يجب أن يمرّ إلى Next.js لا أن يُبتلع.
      if (isFrameworkError(thrown)) throw thrown;
      return jsonError(thrown);
    }
  };
}


function isFrameworkError(thrown: unknown): boolean {
  return (
    typeof thrown === 'object' &&
    thrown !== null &&
    'digest' in thrown &&
    typeof (thrown as { digest: unknown }).digest === 'string' &&
    (thrown as { digest: string }).digest.startsWith('NEXT_')
  );
}
