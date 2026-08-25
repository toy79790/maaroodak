import { z } from 'zod';
import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { templateSchema } from '@/features/admin/schema';
import { saveTemplate } from '@/features/admin/service';
import { listTemplatesAdmin } from '@/features/admin/queries';
import { render } from '@/services/templates/engine';
import { formatArabicDate } from '@/lib/utils/arabic';
import { site } from '@/config/site';

export const GET = createAdminHandler(
  { permission: 'template:manage' },
  async () => jsonOk(await listTemplatesAdmin()),
);

export const POST = createAdminHandler(
  { permission: 'template:manage', body: templateSchema },
  async ({ body, admin }) => {
    const result = await saveTemplate(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);

/**
 * معاينة القالب على بيانات وهمية — بلا حفظ وبلا نداء ذكاء اصطناعي.
 *
 * تُظهر للمسؤول ما سيراه المستخدم فعلاً، وتكشف المتغيرات الناقصة قبل أن
 * تتحوّل إلى علامات نائبة في معاريض حقيقية.
 */
const previewSchema = z.object({ body: z.string().min(1).max(20000) });

const SAMPLE_ANSWERS: Record<string, string> = {
  'a.debt_amount': '85,000',
  'a.creditor_name': 'بنك الرياض',
  'a.emirate_region': 'الرياض',
  'a.decision_subject': 'قرار إنهاء الخدمة',
  'a.complaint_subject': 'تأخر إنجاز معاملة',
};

export const PUT = createAdminHandler(
  { permission: 'template:manage', body: previewSchema },
  async ({ body }) => {
    const context = {
      today: formatArabicDate(new Date()),
      platform_name: site.name,
      department_name: 'وزارة الموارد البشرية والتنمية الاجتماعية',
      department_addressee: 'معالي وزير الموارد البشرية والتنمية الاجتماعية',
      department_honorific: 'معالي',
      request_type_name: 'طلب سداد مديونية',
      subject: 'طلب سداد مديونية',
      full_name: 'محمد بن عبدالله السالم',
      national_id: '1012345678',
      phone: '0512345678',
      city: 'الرياض',
      ai_body:
        'هذا نصّ توضيحي يمثّل موضع المحتوى الذي يكتبه الذكاء الاصطناعي داخل القالب. في المعروض الحقيقي يُبنى هذا الجزء من إجابات المستخدم وحدها.',
      ...SAMPLE_ANSWERS,
    };

    const result = render(body.body, context);

    return jsonOk({
      output: result.output,
      used: result.used,
      missing: result.missing,
    });
  },
);
