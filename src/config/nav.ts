import type { Permission } from '@/lib/auth/rbac';

/**
 * تعريف التنقّل.
 *
 * ⚠️ الأيقونات تُخزَّن **بالاسم لا بالمكوّن**.
 * هذا الملف يُستورَد في تخطيطات الخادم وتُمرَّر قيمه كـ props إلى الشريط
 * الجانبي (مكوّن عميل)، ولا يمكن تمرير دوال React عبر حدّ الخادم/العميل —
 * تُرمى: "Functions cannot be passed directly to Client Components".
 * الربط بين الاسم والمكوّن يحدث داخل مكوّن العميل.
 */

export type NavIconName =
  | 'dashboard'
  | 'newLetter'
  | 'letters'
  | 'favorites'
  | 'credits'
  | 'settings'
  | 'departments'
  | 'categories'
  | 'requestTypes'
  | 'questions'
  | 'conditions'
  | 'templates'
  | 'prompts'
  | 'users'
  | 'analytics'
  | 'auditLogs'
  | 'systemSettings';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** الصلاحية اللازمة لعرض العنصر — الحماية الفعلية تبقى على الخادم. */
  permission?: Permission;
  /** يطابق المسارات الفرعية أيضاً. */
  matchNested?: boolean;
}

export interface NavGroup {
  label?: string;
  items: readonly NavItem[];
}

export const USER_NAV: readonly NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
      { href: '/new', label: 'معروض جديد', icon: 'newLetter', matchNested: true },
      { href: '/letters', label: 'معاريضي', icon: 'letters', matchNested: true },
      { href: '/favorites', label: 'المفضلة', icon: 'favorites' },
    ],
  },
  {
    label: 'الحساب',
    items: [
      { href: '/credits', label: 'الرصيد', icon: 'credits' },
      { href: '/settings', label: 'الإعدادات', icon: 'settings', matchNested: true },
    ],
  },
];

export const ADMIN_NAV: readonly NavGroup[] = [
  {
    items: [{ href: '/admin', label: 'لوحة الإدارة', icon: 'dashboard' }],
  },
  {
    label: 'الكتالوج',
    items: [
      {
        href: '/admin/departments',
        label: 'الجهات',
        icon: 'departments',
        permission: 'department:manage',
        matchNested: true,
      },
      {
        href: '/admin/categories',
        label: 'فئات الجهات',
        icon: 'categories',
        permission: 'department:manage',
      },
      {
        href: '/admin/request-types',
        label: 'أنواع الطلبات',
        icon: 'requestTypes',
        permission: 'requestType:manage',
        matchNested: true,
      },
      {
        href: '/admin/questions',
        label: 'الأسئلة',
        icon: 'questions',
        permission: 'question:manage',
        matchNested: true,
      },
      {
        href: '/admin/templates',
        label: 'القوالب',
        icon: 'templates',
        permission: 'template:manage',
        matchNested: true,
      },
      {
        href: '/admin/prompts',
        label: 'موجّهات الذكاء الاصطناعي',
        icon: 'prompts',
        permission: 'prompt:manage',
        matchNested: true,
      },
    ],
  },
  {
    label: 'المنصة',
    items: [
      {
        href: '/admin/users',
        label: 'المستخدمون',
        icon: 'users',
        permission: 'user:read',
        matchNested: true,
      },
      {
        href: '/admin/letters',
        label: 'المعاريض',
        icon: 'letters',
        permission: 'letter:readAll',
      },
      {
        href: '/admin/analytics',
        label: 'الإحصائيات',
        icon: 'analytics',
        permission: 'analytics:read',
      },
      {
        href: '/admin/audit-logs',
        label: 'سجل التدقيق',
        icon: 'auditLogs',
        permission: 'audit:read',
      },
      {
        href: '/admin/settings',
        label: 'إعدادات النظام',
        icon: 'systemSettings',
        permission: 'settings:manage',
      },
    ],
  },
];
