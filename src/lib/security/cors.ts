import 'server-only';

import { allowedOrigins, isDeployed } from '@/config/env';

/**
 * فحص الأصل و CORS — docs/SECURITY.md §6
 *
 * التطبيق أحادي الأصل (Next.js يقدّم الواجهة والـ API معاً)، فلا حاجة إلى
 * CORS مفتوح أصلاً. الدوال هنا تخدم غرضين:
 *
 *  1. **فحص Origin** على كل طلب مُغيِّر — دفاع ثانٍ بعد `SameSite=Lax`.
 *  2. **CORS مقيّد** لأصول مصرّح بها صراحةً إن لزم لاحقاً (تطبيق جوال،
 *     نطاق فرعي للوحة الإدارة).
 *
 * ⚠️ `Access-Control-Allow-Origin: *` غير مستخدم إطلاقاً: مع الكوكيز يمنعه
 * المتصفح أصلاً، ووجوده يوهم بأن الوصول مفتوح فيُبنى عليه لاحقاً.
 */

/** الأصول المسموح بها — من `NEXT_PUBLIC_APP_URL` و`ALLOWED_ORIGINS`. */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  const normalized = origin.replace(/\/+$/, '');

  if (allowedOrigins.includes(normalized)) return true;

  // في التطوير نقبل أي منفذ محلي — المطوّر قد يشغّل على 3001 أو عبر IP الشبكة.
  if (!isDeployed) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+)(:\d+)?$/.test(
      normalized,
    );
  }

  return false;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface OriginCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * يفحص أصل الطلب المُغيِّر.
 *
 * غياب `Origin` مقبول: بعض العملاء غير المتصفحية لا يرسلونه، والمتصفح
 * يرسله دائماً في الطلبات عبر المواقع — فالغياب ليس هجوم CSRF.
 */
export function checkOrigin(request: {
  method: string;
  headers: Headers;
}): OriginCheck {
  if (!MUTATING_METHODS.has(request.method)) return { allowed: true };

  const origin = request.headers.get('origin');
  if (!origin) return { allowed: true };

  if (isAllowedOrigin(origin)) return { allowed: true };

  return { allowed: false, reason: 'origin_not_allowed' };
}

/**
 * ترويسات CORS لأصل مصرّح به.
 * `Vary: Origin` إلزامي — بدونه تُخزّن الوسائط ترويسة أصل واحد وتُعيدها لغيره.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin) || !origin) {
    return { Vary: 'Origin' };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
