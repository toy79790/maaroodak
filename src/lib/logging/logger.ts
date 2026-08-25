import 'server-only';

import { env, isDeployed, type LogLevel } from '@/config/env';

/**
 * سجلّ مهيكل مع تعقيم إلزامي — docs/SECURITY.md §11
 *
 * مبدآن حاكمان:
 *
 * 1. **التعقيم افتراضي لا اختياري.** لا نعتمد على انتباه كاتب السطر إلى
 *    ألّا يُمرّر كلمة مرور؛ الحقول الحساسة تُحجب بالاسم مهما كان مصدرها.
 *    اعتماد الحجب على الانضباط البشري يفشل عند أول سطر مستعجل.
 *
 * 2. **مخرَج JSON في البيئات المنشورة** ليلتقطه أي مُجمِّع سجلات
 *    (Vercel · Datadog · CloudWatch) بلا تحليل نصّي هشّ. وفي التطوير
 *    مخرَج مقروء للبشر.
 */

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const threshold = LEVEL_ORDER[env.LOG_LEVEL];

/**
 * أسماء الحقول التي تُحجب قيمتها دائماً.
 * المطابقة جزئية وغير حساسة لحالة الأحرف: `userPassword` و`api_key` يُحجبان.
 */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'sessionsecret',
  'accesskey',
  'nationalid',
  'national_id',
  'iban',
  'cardnumber',
  'cvv',
  'otp',
  // محتوى المعروض وإجابات المستخدم لا تدخل السجلات أبداً.
  'contenthtml',
  'contenttext',
  'answers',
  'prompt',
  'completion',
];

const REDACTED = '[محجوب]';
const MAX_DEPTH = 4;
const MAX_STRING = 2000;

function shouldRedact(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '');
  return REDACTED_KEYS.some((needle) =>
    normalized.includes(needle.replace(/[-_]/g, '')),
  );
}

/** تعقيم عميق مع حدّ للعمق يمنع الدوران اللانهائي على البنى الدائرية. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // أثر المكدّس في البيئات المنشورة فقط — لا فائدة منه في مخرَج التطوير المقروء.
      ...(isDeployed && value.stack ? { stack: value.stack.split('\n').slice(0, 8) } : {}),
    };
  }

  if (depth >= MAX_DEPTH) return '[عمق أقصى]';

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = shouldRedact(key) ? REDACTED : redact(item, depth + 1);
    }

    return output;
  }

  return String(value);
}

export interface LogContext {
  /** مجال الحدث: 'auth' · 'ai' · 'db' · 'admin' · 'api' */
  scope?: string;
  userId?: string | null;
  requestId?: string | null;
  durationMs?: number;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  if (LEVEL_ORDER[level] < threshold) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    env: env.APP_ENV,
    message,
    ...(redact(context) as Record<string, unknown>),
  };

  const target =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (isDeployed) {
    target(JSON.stringify(entry));
    return;
  }

  const scope = context.scope ? `[${context.scope}] ` : '';
  const extra = Object.keys(context).filter((key) => key !== 'scope');
  target(
    `${level.toUpperCase().padEnd(5)} ${scope}${message}`,
    extra.length > 0 ? redact(context) : '',
  );
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
} as const;

// ---------------------------------------------------------------------------
// أحداث مسمّاة — تمنع اختلاف الصياغة بين المستدعين
// ---------------------------------------------------------------------------

export const events = {
  authSuccess: (userId: string, action: 'login' | 'register') =>
    logger.info('نجاح مصادقة', { scope: 'auth', userId, action }),

  authFailure: (action: string, reason: string, ip?: string) =>
    logger.warn('فشل مصادقة', { scope: 'auth', action, reason, ip }),

  rateLimited: (scope: string, identifier: string) =>
    // المعرّف قد يحوي IP — يبقى مفيداً للتحقيق الأمني ومسموحاً بحفظه.
    logger.warn('تجاوز حد المعدّل', { scope: 'security', limitScope: scope, identifier }),

  aiFailure: (operation: string, kind: string, model: string) =>
    logger.error('فشل نداء ذكاء اصطناعي', { scope: 'ai', operation, kind, model }),

  aiSlow: (operation: string, durationMs: number, model: string) =>
    logger.warn('نداء ذكاء اصطناعي بطيء', { scope: 'ai', operation, durationMs, model }),

  dbFailure: (operation: string, error: unknown) =>
    logger.error('فشل عملية قاعدة بيانات', { scope: 'db', operation, error }),

  adminAction: (actorId: string, action: string, entity: string, entityId?: string) =>
    logger.info('عملية إدارية', { scope: 'admin', userId: actorId, action, entity, entityId }),

  apiError: (path: string, code: string, status: number, error?: unknown) =>
    logger.error('خطأ في مسار API', { scope: 'api', path, code, status, error }),
} as const;
