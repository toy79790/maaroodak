import Link from 'next/link';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PRICE_PER_LETTER_SAR } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

/**
 * تنبيه الرصيد قبل الحاجة إليه — #D-052
 *
 * كان المستخدم الجديد (رصيده صفر) يجيب عن المقابلة كاملة ثم يكتشف عند
 * «أنشئ المعروض» أنه لا يملك رصيداً، بإشعار يختفي بعد ثوانٍ. لا نمنعه من
 * البدء — إجاباته تُحفظ — لكن يعرف قبل أن يستثمر وقته.
 */

const MESSAGES = {
  dashboard: 'إنشاء المعروض يحتاج رصيد معروض واحد. أضف رصيداً قبل أن تبدأ أو أثناءه.',
  start: 'ابدأ وأجب عن الأسئلة الآن — تُحفظ إجاباتك تلقائياً — وأنشئ المعروض بعد إضافة الرصيد.',
  review: 'إجاباتك محفوظة. أضف رصيداً ثم عُد إلى هذه الصفحة لإنشاء المعروض.',
} as const;

export function CreditNotice({
  context,
  className,
}: {
  context: keyof typeof MESSAGES;
  className?: string;
}) {
  return (
    <Card
      role="status"
      className={cn('border-warning/40 bg-warning-subtle p-4 sm:p-5', className)}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Coins className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium">
              رصيدك لا يكفي لإنشاء معروض ({PRICE_PER_LETTER_SAR} ريالاً للمعروض)
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{MESSAGES[context]}</p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm" className="sm:shrink-0">
          <Link href="/credits">كيف أشتري رصيداً؟</Link>
        </Button>
      </div>
    </Card>
  );
}
