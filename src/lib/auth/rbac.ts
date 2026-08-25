import type { UserRole } from '@prisma/client';

/**
 * الصلاحيات — docs/SECURITY.md §3 · docs/DECISIONS.md #D-006
 *
 * خريطة صريحة قابلة للاختبار بدل جدول أدوار في القاعدة: المجموعة مغلقة،
 * والخريطة تُقرأ في مراجعة الشيفرة كاملةً في شاشة واحدة.
 */

export const PERMISSIONS = [
  // موارد المستخدم نفسه
  'letter:own',
  'interview:own',
  'profile:own',
  'favorite:own',
  'credits:own',
  // إدارة الكتالوج
  'department:manage',
  'requestType:manage',
  'question:manage',
  'template:manage',
  'prompt:manage',
  // إدارة المنصة
  'user:read',
  'user:manage',
  'letter:readAll',
  'letter:readContent',
  'analytics:read',
  'plan:manage',
  'settings:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const USER_PERMISSIONS: readonly Permission[] = [
  'letter:own',
  'interview:own',
  'profile:own',
  'favorite:own',
  'credits:own',
];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...USER_PERMISSIONS,
  'department:manage',
  'requestType:manage',
  'question:manage',
  'template:manage',
  'prompt:manage',
  'user:read',
  'letter:readAll',
  'analytics:read',
  'plan:manage',
  'settings:manage',
  'audit:read',
];

/**
 * لماذا `letter:readContent` للـ SUPER_ADMIN وحده؟
 * محتوى المعاريض يتضمن ظروفاً شخصية ومالية وصحية. إدارة المنصة تحتاج
 * الإحصاءات والبيانات الوصفية، لا قراءة خطابات الناس.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  USER: USER_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: PERMISSIONS,
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function canAll(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/** هل يصل هذا الدور إلى لوحة التحكم أصلاً؟ */
export function isAdminRole(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
