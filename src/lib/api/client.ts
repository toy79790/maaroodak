'use client';

import type { ErrorCode } from '@/lib/api/errors';

/**
 * عميل الـ API للمتصفح.
 *
 * سبب وجوده: توحيد قراءة شكل الاستجابة `{ok, data|error}` في مكان واحد.
 * بدونه يتكرر في كل نموذج تحليل الاستجابة ومعالجة أخطاء الحقول، وتُنسى
 * حالة الخطأ في مكان ما حتماً.
 */

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly fields: Record<string, string>;
  readonly status: number;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.fields = payload.fields ?? {};
    this.status = status;
  }
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<ApiSuccess<T>> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      ...init,
    });
  } catch {
    // فشل شبكي قبل الوصول للخادم — رسالة مفهومة بدل "Failed to fetch".
    throw new ApiError(
      { code: 'INTERNAL', message: 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.' },
      0,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      { code: 'INTERNAL', message: 'رد غير متوقع من الخادم.' },
      response.status,
    );
  }

  const envelope = payload as
    | { ok: true; data: T; meta?: ApiSuccess<T>['meta'] }
    | { ok: false; error: ApiErrorPayload };

  if (!envelope.ok) {
    throw new ApiError(envelope.error, response.status);
  }

  return { data: envelope.data, ...(envelope.meta ? { meta: envelope.meta } : {}) };
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('POST', path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('PATCH', path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('PUT', path, body, init),
  delete: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>('DELETE', path, body, init),
} as const;
