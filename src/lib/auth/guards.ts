import 'server-only';

import { redirect } from 'next/navigation';
import { getSession, type AuthContext } from '@/lib/auth/session';
import { can, isAdminRole, type Permission } from '@/lib/auth/rbac';
import { errors } from '@/lib/api/errors';

/**
 * حرّاس الوصول — docs/SECURITY.md §3
 *
 * نسختان مقصودتان:
 *  · `require*`  للصفحات (RSC) — تُعيد التوجيه.
 *  · `assert*`   لمسارات الـ API — ترمي AppError يلتقطها معالج المسار.
 *
 * كل Route Handler يستدعي `assert*` بنفسه ولا يعتمد على حارس الـ Layout:
 * الـ Layout لا يعمل على مسارات الـ API، والاعتماد عليه ثغرة كلاسيكية.
 */

// --- للصفحات (RSC) ----------------------------------------------------------

export async function requireUser(redirectTo = '/login'): Promise<AuthContext> {
  const session = await getSession();
  if (!session) redirect(redirectTo);
  return session;
}

export async function requireAdmin(): Promise<AuthContext> {
  const session = await requireUser();
  if (!isAdminRole(session.user.role)) redirect('/dashboard');
  return session;
}

export async function requirePermission(
  permission: Permission,
): Promise<AuthContext> {
  const session = await requireUser();
  if (!can(session.user.role, permission)) redirect('/dashboard');
  return session;
}

/** للصفحات العامة التي يجب ألّا يراها مسجّل الدخول (login/register). */
export async function requireGuest(redirectTo = '/dashboard'): Promise<void> {
  const session = await getSession();
  if (session) redirect(redirectTo);
}

// --- لمسارات الـ API --------------------------------------------------------

export async function assertUser(): Promise<AuthContext> {
  const session = await getSession();
  if (!session) throw errors.unauthorized();
  return session;
}

export async function assertPermission(
  permission: Permission,
): Promise<AuthContext> {
  const session = await assertUser();
  if (!can(session.user.role, permission)) throw errors.forbidden();
  return session;
}

export async function assertAdmin(): Promise<AuthContext> {
  const session = await assertUser();
  if (!isAdminRole(session.user.role)) throw errors.forbidden();
  return session;
}
