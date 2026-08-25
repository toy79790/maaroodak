import { NextResponse } from 'next/server';
import { AppError, toAppError } from '@/lib/api/errors';
import { isDeployed } from '@/config/env';
import { logger } from '@/lib/logging/logger';

/** شكل الاستجابة الموحّد — docs/API.md §1 */

export interface PaginationMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

export function jsonOk<T>(
  data: T,
  init?: { status?: number; meta?: PaginationMeta; headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(
    { ok: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function jsonError(thrown: unknown): NextResponse {
  const error = toAppError(thrown);

  // لا Stack Trace للمستخدم — يُسجَّل على الخادم فقط، معقَّماً.
  if (error.code === 'INTERNAL') {
    logger.error('خطأ داخلي غير متوقع', {
      scope: 'api',
      code: error.code,
      error: error.cause ?? error,
    });
  } else if (error.status >= 500) {
    logger.error('خطأ خادم', { scope: 'api', code: error.code });
  }

  const headers = new Headers();
  if (error.retryAfter !== undefined) {
    headers.set('Retry-After', String(error.retryAfter));
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        ...error.toClient(),
        // في التطوير فقط: تلميح عن السبب لتسريع التصحيح.
        // لا يظهر في staging ولا الإنتاج — قد يحوي تفاصيل بنية داخلية.
        ...(isDeployed || !error.cause
          ? {}
          : { debug: String((error.cause as Error)?.message ?? error.cause) }),
      },
    },
    { status: error.status, headers },
  );
}

/** يحوّل أخطاء Zod إلى خريطة حقول عربية. */
export function zodFieldErrors(
  issues: readonly { path: readonly (string | number | symbol)[]; message: string }[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export type { AppError };
