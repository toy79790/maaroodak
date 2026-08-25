import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { site } from '@/config/site';

/**
 * الشعار — ورقة مطوية بحرف «م».
 * SVG مضمّن لا ملف: لا طلب شبكة، ويرث لون النص، ويظهر فوراً بلا وميض.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8', className)}
    >
      <rect
        x="4"
        y="2.5"
        width="24"
        height="27"
        rx="4"
        className="fill-primary"
      />
      <path d="M28 21.5V25a4 4 0 0 1-4 4h-3.5L28 21.5Z" className="fill-brand-800" />
      <path
        d="M10.5 20.5v-5.2c0-1.6 1.1-2.8 2.6-2.8 1.4 0 2.4 1 2.4 2.5v5.5m0-5.5c0-1.5 1-2.5 2.4-2.5 1.5 0 2.6 1.2 2.6 2.8v5.2"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  href = '/',
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-lg font-bold text-lg',
        className,
      )}
    >
      <LogoMark />
      <span>{site.name}</span>
    </Link>
  );
}
