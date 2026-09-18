import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Logo } from '@/components/layout/logo';
import { site, AI_DISCLAIMER_SHORT } from '@/config/site';

const FOOTER_SECTIONS = [
  {
    title: 'المنصة',
    links: [
      { href: '/#how-it-works', label: 'كيف تعمل' },
      { href: '/departments', label: 'الجهات المدعومة' },
      { href: '/request-types', label: 'أنواع المعاريض' },
      { href: '/#pricing', label: 'الأسعار' },
    ],
  },
  {
    title: 'عن المنصة',
    links: [
      { href: '/about', label: 'من نحن' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
      { href: '/contact', label: 'تواصل معنا' },
    ],
  },
  {
    title: 'الحساب',
    links: [
      { href: '/register', label: 'إنشاء حساب' },
      { href: '/login', label: 'تسجيل الدخول' },
      { href: '/dashboard', label: 'لوحة التحكم' },
    ],
  },
  {
    title: 'قانوني',
    links: [
      { href: '/privacy', label: 'سياسة الخصوصية' },
      { href: '/terms', label: 'شروط الاستخدام' },
      { href: '/ai-disclaimer', label: 'إخلاء مسؤولية الذكاء الاصطناعي' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/50">
      <Container>
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {site.description}
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border py-6">
          <p className="text-xs leading-relaxed text-subtle-foreground">
            {AI_DISCLAIMER_SHORT}
          </p>
          <p className="mt-2 text-xs text-subtle-foreground">
            © {new Date().getFullYear()} {site.name}. جميع الحقوق محفوظة.
          </p>
        </div>
      </Container>
    </footer>
  );
}
