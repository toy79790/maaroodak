import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { appEnv, isAIConfigured, env } from '@/config/env';
import { getStorage, StorageError } from '@/services/storage';
import { isMailConfigured } from '@/lib/mail/mailer';

/**
 * الفحص الصحي — docs/DEPLOYMENT.md §10
 *
 * ⚠️ عام بلا مصادقة عمداً: موازِنات الحمل وأدوات المراقبة تستدعيه قبل وجود
 * أي جلسة. ولهذا **لا يكشف أي سرّ**: لا روابط اتصال، ولا مفاتيح، ولا أسماء
 * مضيفين، ولا رسائل أخطاء داخلية — حالة فقط.
 *
 *   200 ⟶ كل التبعيات الحرجة تعمل
 *   503 ⟶ تبعية حرجة معطّلة (قاعدة البيانات)
 *
 * الذكاء الاصطناعي والتخزين ليسا حرجَين: المنصة تعمل بدونهما بوظائف أقل،
 * فتعطّلهما يُبلَّغ ولا يُسقط الفحص.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Status = 'ok' | 'degraded' | 'down' | 'not_configured';

interface CheckResult {
  status: Status;
  latencyMs?: number;
}

const DB_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<CheckResult> {
  const started = Date.now();

  try {
    // استعلام لا يلمس أي جدول — يفحص الاتصال وحده.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS),
      ),
    ]);

    return { status: 'ok', latencyMs: Date.now() - started };
  } catch {
    // لا نُمرّر نص الخطأ: قد يحوي اسم المضيف أو اسم المستخدم.
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

function checkAi(): CheckResult {
  return { status: isAIConfigured ? 'ok' : 'not_configured' };
}

/** البريد: `not_configured` لا يُسقط الصحة، لكنه يعني أن «نسيت كلمة المرور» لا تصل. */
function checkMail(): CheckResult {
  return { status: isMailConfigured ? 'ok' : 'not_configured' };
}

function checkStorage(): CheckResult {
  try {
    return { status: getStorage().isReady ? 'ok' : 'not_configured' };
  } catch (error) {
    /*
     * `not_configured` لا `down`: في بيئة منشورة بلا `STORAGE_DRIVER=s3`
     * يرفض `getStorage()` العمل عمداً. هذا إعداد ناقص لا عطل — و v1 لا
     * ترفع ملفات أصلاً، فالتمييز يمنع إنذاراً كاذباً دائماً في المراقبة.
     */
    const kind = (error as StorageError)?.kind;
    return { status: kind === 'not_configured' ? 'not_configured' : 'down' };
  }
}

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  const [database, ai, mail, storage] = [
    await checkDatabase(),
    checkAi(),
    checkMail(),
    checkStorage(),
  ];

  const healthy = database.status === 'ok';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'unhealthy',
      environment: appEnv,
      // نسخة البناء تساعد على تأكيد أن النشر وصل فعلاً.
      version: env.APP_ENV === 'development' ? 'dev' : (process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown'),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, ai, mail, storage },
      durationMs: Date.now() - startedAt,
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
