import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
        <FileQuestion className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        الرابط الذي فتحته غير صحيح، أو أن العنصر حُذف أو لا يخصّ حسابك.
      </p>
      {/* الرئيسية أولاً: هذه الصفحة تظهر للزائر غير المسجَّل أيضاً، وتوجيهه
          إلى لوحة التحكم يرميه على شاشة تسجيل دخول لا يريدها. */}
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/">الصفحة الرئيسية</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">لوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
