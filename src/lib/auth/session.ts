import 'server-only';

import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { env, isDeployed } from '@/config/env';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  SESSION_SLIDING_RENEWAL_HOURS,
} from '@/config/constants';

/**
 * الجلسات — docs/SECURITY.md §2 · docs/DECISIONS.md #D-005
 *
 * نموذج هجين: JWT في كوكي httpOnly يحمل معرّف الجلسة فقط (`sid`)، وسجل
 * `Session` في القاعدة يحمل SHA-256 للرمز.
 *
 * لماذا لا JWT عديم الحالة بالكامل؟ لأننا نحتاج إبطالاً فورياً: تغيير كلمة
 * المرور، تسجيل الخروج من كل الأجهزة، وتعطيل حساب. رمز عديم الحالة يبقى
 * صالحاً حتى انتهائه مهما فعلنا.
 *
 * ولماذا لا نخزّن الرمز نفسه؟ لأن تسريب قاعدة البيانات عندها يمنح المهاجم
 * جلسات جاهزة. التجزئة تجعل التسريب بلا قيمة.
 */

const SECRET = new TextEncoder().encode(env.SESSION_SECRET);
const ALG = 'HS256';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  creditBalance: number;
  phone: string | null;
  nationalId: string | null;
  city: string | null;
  organizationId: string | null;
}

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiryDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** ينشئ جلسة في القاعدة ويضع الكوكي. يُستدعى بعد تحقق ناجح فقط. */
export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = expiryDate();

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: meta.ip?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 256) ?? null,
    },
    select: { id: true },
  });

  const jwt = await new SignJWT({ sid: session.id, tok: token })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    // `secure` في staging أيضاً لا في الإنتاج وحده — كلاهما خلف HTTPS.
    secure: isDeployed,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

interface SessionClaims {
  sid: string;
  tok: string;
}

async function readClaims(): Promise<SessionClaims | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(raw, SECRET, { algorithms: [ALG] });
    const sid = payload.sid;
    const tok = payload.tok;
    if (typeof sid !== 'string' || typeof tok !== 'string') return null;
    return { sid, tok };
  } catch {
    // رمز تالف أو منتهٍ أو موقّع بمفتاح آخر — يُعامل كغياب جلسة.
    return null;
  }
}

/**
 * الجلسة الحالية أو null. لا ترمي استثناءً — للاستخدام في المسارات العامة.
 *
 * الدور والرصيد يُقرآن من القاعدة في كل طلب عمداً: لو اعتمدنا على ما بداخل
 * الرمز لظلّ مستخدمٌ رُقّي أو عُطّل يعمل بصلاحياته القديمة حتى انتهاء الرمز.
 */
export async function getSession(): Promise<AuthContext | null> {
  const claims = await readClaims();
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      tokenHash: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          creditBalance: true,
          phone: true,
          nationalId: true,
          city: true,
          isActive: true,
          memberships: {
            select: { organizationId: true },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.tokenHash !== hashToken(claims.tok)) return null;
  if (!session.user.isActive) return null;

  // تجديد منزلق: نُحدّث آخر ظهور مرة واحدة يومياً لا في كل طلب.
  const staleAfter = SESSION_SLIDING_RENEWAL_HOURS * 60 * 60 * 1000;
  if (Date.now() - session.lastSeenAt.getTime() > staleAfter) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: expiryDate() },
    });
  }

  const { user } = session;

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      creditBalance: user.creditBalance,
      phone: user.phone,
      nationalId: user.nationalId,
      city: user.city,
      organizationId: user.memberships[0]?.organizationId ?? null,
    },
  };
}

/** يُبطل الجلسة الحالية ويحذف الكوكي. */
export async function destroySession(): Promise<void> {
  const claims = await readClaims();

  if (claims) {
    await prisma.session
      .updateMany({
        where: { id: claims.sid, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * يُبطل كل جلسات المستخدم — يُستدعى عند تغيير كلمة المرور أو استعادتها.
 * `exceptSessionId` يُبقي الجلسة الحالية حيّة عند تغيير كلمة المرور طوعاً.
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** تنظيف الجلسات المنتهية — يُستدعى من مهمة دورية. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
