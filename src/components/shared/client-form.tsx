'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * نموذج يُرسَل بـ JavaScript — بأمان قبل أن يكتمل تحميله.
 *
 * نماذجنا تعترض الإرسال في onSubmit وترسل JSON. لكن الضغط على Enter قبل
 * hydration يُرسل النموذج إرسالاً أصلياً، وبلا method يكون GET: فتنتقل
 * الحقول — كلمة المرور منها — إلى الرابط، ومنه إلى سجل المتصفح وسجلات
 * nginx. انظر DECISIONS.md #D-049.
 *
 * طبقتان:
 *  ١) method="post" مثبّتة لا تُستبدل — لو أفلت إرسال أصلي فالحقول في جسم
 *     الطلب لا في رابطه، والصفحة تعيد نفسها.
 *  ٢) SubmitButton معطّل حتى hydration — والزر الافتراضي المعطّل يمنع
 *     الإرسال الضمني بـ Enter أصلاً، فلا يُفقد ما كتبه المستخدم.
 */
export function ClientForm(
  props: Omit<React.FormHTMLAttributes<HTMLFormElement>, 'method' | 'action'>,
) {
  return <form {...props} method="post" />;
}

const subscribe = () => () => {};

/** false في HTML الخادم وأثناء hydration، ثم true. */
function useHydrated() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** زر الإرسال لـ ClientForm: معطّل قبل hydration وأثناء التحميل. */
export function SubmitButton({ disabled, loading, ...props }: Omit<ButtonProps, 'type'>) {
  const hydrated = useHydrated();
  return (
    <Button
      {...props}
      type="submit"
      loading={loading}
      disabled={!hydrated || Boolean(disabled) || Boolean(loading)}
    />
  );
}
