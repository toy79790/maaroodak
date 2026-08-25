import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/config/constants';

/**
 * فحص سريع على حافة الشبكة — docs/SECURITY.md §3
 *
 * ⚠️ هذا **ليس** حارس أمان. الـ middleware يعمل على Edge Runtime بلا وصول
 * إلى قاعدة البيانات، فلا يستطيع التحقق من صلاحية الجلسة أو دور المستخدم.
 * كل ما يفعله: توفير رحلة ذهاب وإياب لمن لا يملك كوكياً أصلاً.
 *
 * التحقق الحقيقي يقع في `requireUser` / `assertUser` على الخادم.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/new',
  '/letters',
  '/favorites',
  '/settings',
  '/credits',
  '/admin',
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) return NextResponse.next();

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * كل المسارات عدا: مسارات الـ API (تحمي نفسها)، وملفات Next الثابتة،
     * والصور، والأيقونة.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
