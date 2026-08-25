/**
 * ثوابت الهوية والمحتوى التسويقي.
 * تُقرأ من هنا لا من نصوص مبعثرة في المكوّنات.
 */

import { publicEnv } from '@/config/public-env';

export const site = {
  name: 'معروضك',
  nameEn: 'Maroudak',
  tagline: 'اكتب معروضك في دقائق',
  description:
    'أجب عن عدة أسئلة بسيطة، ودع الذكاء الاصطناعي يساعدك في صياغة خطاب رسمي مناسب لطلبك.',
  /**
   * ⚠️ لا نطاق ثابت في الشيفرة — يأتي من `NEXT_PUBLIC_APP_URL`.
   * هذا ما يجعل نفس البناء صالحاً لأي نطاق: staging، إنتاج، أو نطاق عميل.
   */
  url: publicEnv.appUrl,
  locale: 'ar_SA',
  supportEmail: publicEnv.supportEmail,
} as const;

/**
 * إخلاء المسؤولية — يظهر في المعاينة وفي كل ملف مُصدَّر.
 * انظر docs/AI_SYSTEM.md §13
 */
export const AI_DISCLAIMER =
  'أُعدّ هذا الخطاب بمساعدة الذكاء الاصطناعي. المنصة تساعد في الصياغة ولا تقدّم استشارة قانونية. يرجى مراجعة المحتوى والتأكد من صحة البيانات قبل التقديم.';

export const AI_DISCLAIMER_SHORT =
  'المنصة تساعد في صياغة الخطابات ولا تقدّم استشارة قانونية.';
