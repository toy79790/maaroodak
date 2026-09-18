import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';
import { env, publicAppUrl } from '@/config/env';
import { site } from '@/config/site';
import { logger } from '@/lib/logging/logger';

/**
 * البريد الصادر — docs/ENVIRONMENT.md §البريد
 *
 * مزوّد واحد عبر `SMTP_URL` (أي خدمة SMTP: Amazon SES · Zoho · Resend …)،
 * فلا ارتباط بمزوّد بعينه في الشيفرة. بدون `SMTP_URL` البريد «غير مهيّأ»:
 * لا يفشل الطلب، ويُسجَّل تحذير ويظهر في الفحص الصحي.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const isMailConfigured = env.SMTP_URL.length > 0;

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

/** المرسِل: `MAIL_FROM` إن وُجد، وإلا `no-reply@<النطاق>` — لا نطاق في الشيفرة. */
function sender(): string {
  const address =
    env.MAIL_FROM || `no-reply@${new URL(publicAppUrl).hostname.replace(/^www\./, '')}`;
  return `"${site.name}" <${address}>`;
}

/**
 * يرسل رسالة. لا يرمي أبداً: فشل البريد يُسجَّل ولا يُسقط العملية التي
 * استدعته، ويُرجع `false` لمن يهمّه الأمر.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  if (!isMailConfigured) {
    logger.warn('البريد غير مهيّأ — لم تُرسل الرسالة', {
      scope: 'mail',
      subject: message.subject,
    });
    return false;
  }

  try {
    await getTransporter().sendMail({ from: sender(), ...message });
    logger.info('أُرسلت رسالة بريد', { scope: 'mail', subject: message.subject });
    return true;
  } catch (error) {
    // لا نُسجّل المستلم ولا النص: الرسالة قد تحمل رمز استعادة.
    logger.error('فشل إرسال البريد', { scope: 'mail', subject: message.subject, error });
    return false;
  }
}

/** رسالة استعادة كلمة المرور — نص وHTML معاً لأن بعض العملاء يعرضون النص فقط. */
export function passwordResetMessage(to: string, resetUrl: string, ttlMinutes: number): MailMessage {
  const subject = `استعادة كلمة المرور — ${site.name}`;

  const text = [
    'مرحباً،',
    '',
    `وصلنا طلب لإعادة تعيين كلمة مرور حسابك في ${site.name}.`,
    'لتعيين كلمة مرور جديدة افتح الرابط التالي:',
    resetUrl,
    '',
    `الرابط صالح لمدة ${ttlMinutes} دقيقة ولمرة واحدة.`,
    'إن لم تطلب ذلك فتجاهل هذه الرسالة، وستبقى كلمة مرورك كما هي.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;padding:24px;background:#f6f5f1;font-family:Tahoma,Arial,sans-serif;color:#1c1c1c">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;text-align:right">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0e6f52">${site.name}</h1>
      <p style="margin:0 0 12px;line-height:1.8">وصلنا طلب لإعادة تعيين كلمة مرور حسابك.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#0e6f52;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px">تعيين كلمة مرور جديدة</a>
      </p>
      <p style="margin:0 0 8px;line-height:1.8;font-size:14px;color:#555">الرابط صالح لمدة ${ttlMinutes} دقيقة ولمرة واحدة.</p>
      <p style="margin:0;line-height:1.8;font-size:14px;color:#555">إن لم تطلب ذلك فتجاهل هذه الرسالة، وستبقى كلمة مرورك كما هي.</p>
    </div>
  </body>
</html>`;

  return { to, subject, text, html };
}
