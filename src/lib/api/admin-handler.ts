import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { jsonError, zodFieldErrors } from '@/lib/api/response';
import { errors } from '@/lib/api/errors';
import { assertPermission } from '@/lib/auth/guards';
import { clientIp } from '@/lib/security/rate-limit';
import { checkOrigin } from '@/lib/security/cors';
import type { Permission } from '@/lib/auth/rbac';
import type { AdminContext } from '@/features/admin/service';

/**
 * غلاف مسارات الإدارة.
 *
 * يضمن أن **كل** مسار إداري يمرّ بالتسلسل نفسه: فحص Origin ← فحص الصلاحية
 * ← التحقق ← بناء سياق التدقيق. الحارس هنا لا في التخطيط: التخطيط لا يعمل
 * على مسارات الـ API (docs/SECURITY.md §3).
 */

function assertSameOrigin(request: NextRequest): void {
  if (!checkOrigin(request).allowed) {
    throw errors.forbidden('طلب غير مصرّح به من مصدر خارجي.');
  }
}

export interface AdminHandlerArgs<TBody, TParams> {
  request: NextRequest;
  body: TBody;
  params: TParams;
  admin: AdminContext;
}

export function createAdminHandler<TBody = undefined, TParams = Record<string, never>>(
  options: {
    permission: Permission;
    body?: z.ZodType<TBody>;
  },
  handler: (args: AdminHandlerArgs<TBody, TParams>) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> } = { params: Promise.resolve({} as TParams) },
  ): Promise<NextResponse> => {
    try {
      assertSameOrigin(request);

      const session = await assertPermission(options.permission);

      let body = undefined as TBody;
      if (options.body) {
        const raw = await readJson(request);
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          throw errors.validation(zodFieldErrors(parsed.error.issues));
        }
        body = parsed.data;
      }

      const params = await context.params;

      return await handler({
        request,
        body,
        params,
        admin: {
          actorId: session.user.id,
          ip: clientIp(request.headers),
          userAgent: request.headers.get('user-agent') ?? undefined,
        },
      });
    } catch (thrown) {
      if (isFrameworkError(thrown)) throw thrown;
      return jsonError(thrown);
    }
  };
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    const text = await request.text();
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw errors.validation({}, 'صيغة الطلب غير صالحة.');
  }
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
