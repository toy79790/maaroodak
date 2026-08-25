'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'كيف تعمل' },
  { href: '#features', label: 'المميزات' },
  { href: '#departments', label: 'الجهات' },
  { href: '#pricing', label: 'الأسعار' },
  { href: '#faq', label: 'الأسئلة الشائعة' },
] as const;

export function MarketingHeader() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200',
        isScrolled
          ? 'border-border bg-background/85 backdrop-blur-md'
          : 'border-transparent bg-background',
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">تسجيل الدخول</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">ابدأ مجاناً</Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
            aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-surface-muted md:hidden"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      {isOpen ? (
        <div id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <Container>
            <nav aria-label="تنقل الجوال" className="flex flex-col py-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <Button variant="secondary" block asChild>
                  <Link href="/login">تسجيل الدخول</Link>
                </Button>
                <Button block asChild>
                  <Link href="/register">ابدأ مجاناً</Link>
                </Button>
              </div>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
