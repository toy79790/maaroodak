/**
 * قوالب المعاريض.
 *
 * القالب يحدّد **الهيكل الرسمي** فقط — المخاطبة والافتتاحية والخاتمة وخانة
 * البيانات. المحتوى يكتبه الذكاء الاصطناعي في `{{ai_body}}`.
 * هذا الفصل هو ما يجعل المخرجات ديناميكية لا نمطية (docs/ARCHITECTURE.md §6).
 *
 * المتغيرات المتاحة:
 *   نظام : {{today}} {{platform_name}}
 *   جهة  : {{department_name}} {{department_addressee}} {{honorific}}
 *   طلب  : {{request_type_name}} {{subject}}
 *   ملف  : {{full_name}} {{national_id}} {{phone}} {{city}}
 *   إجابة: {{a.<question_key>}}
 *   ذكاء : {{ai_body}}
 */

export interface TemplateSeed {
  slug: string;
  name: string;
  description: string;
  body: string;
  isDefault?: boolean;
  /** slug الجهة — يحدّد متى يُختار هذا القالب */
  department?: string;
  requestType?: string;
}

/** خانة البيانات أسفل كل معروض — موحّدة. */
const SIGNATURE_BLOCK = `
مقدّمه لكم / {{full_name}}
{{#if national_id}}رقم الهوية: {{national_id}}{{/if}}
{{#if phone}}رقم الجوال: {{phone}}{{/if}}
{{#if city}}المدينة: {{city}}{{/if}}
التاريخ: {{today}}

التوقيع: ........................`.trim();

export const TEMPLATES: readonly TemplateSeed[] = [
  {
    slug: 'default-government',
    name: 'القالب الحكومي الافتراضي',
    description:
      'الصيغة الرسمية المعتادة لمخاطبة الوزارات والجهات الحكومية.',
    isDefault: true,
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

وتفضلوا بقبول خالص الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'royal-court',
    name: 'قالب المقام السامي',
    description:
      'صيغة رفع المعاريض إلى الديوان الملكي — مخاطبة أعلى وافتتاحية مناسبة.',
    department: 'royal-court',
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله ورعاه

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

أرفع لمقامكم الكريم هذا المعروض، راجياً من الله ثم من كرمكم النظر فيه بعين العطف والرعاية.

{{ai_body}}

هذا وأسأل الله أن يحفظكم ويرعاكم، وأن يجزيكم عن رعاياكم خير الجزاء.

وتفضلوا بقبول وافر الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'regional-emirate',
    name: 'قالب إمارة المنطقة',
    description: 'صيغة مخاطبة أمير المنطقة.',
    department: 'regional-emirates',
    body: `بسم الله الرحمن الرحيم

صاحب السمو الملكي أمير {{a.emirate_region}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

أرفع لسموكم الكريم هذا المعروض، راجياً من الله ثم من سموكم النظر في طلبي.

{{ai_body}}

وتفضلوا بقبول خالص الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'service-commercial',
    name: 'القالب الخدمي والتجاري',
    description:
      'صيغة أقصر وأكثر مباشرة لمخاطبة البنوك وشركات التمويل والاتصالات والخدمات.',
    body: `{{department_addressee}}
المحترم

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

شاكرين لكم حسن تعاونكم، وتفضلوا بقبول التحية.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'educational',
    name: 'القالب التعليمي',
    description: 'صيغة مخاطبة الجامعات والمدارس والمعاهد.',
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
المحترم

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

وتفضلوا بقبول خالص الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'complaint-grievance',
    name: 'قالب الشكوى والتظلم',
    description:
      'صيغة تُبرز الوقائع والمطلوب — تُستخدم للشكاوى والتظلمات والاعتراضات.',
    requestType: 'complaint',
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

وعليه، آمل من سعادتكم التكرم بالنظر في الموضوع واتخاذ ما ترونه مناسباً.

وتفضلوا بقبول خالص الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'grievance-formal',
    name: 'قالب التظلم الرسمي',
    description: 'صيغة التظلم من قرار إداري — تذكر القرار ومحلّ التظلم.',
    requestType: 'grievance',
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: تظلم بشأن {{a.decision_subject}}

{{ai_body}}

وعليه، ألتمس من سعادتكم إعادة النظر في القرار المشار إليه، ورفع ما لحقني من ضرر.

وتفضلوا بقبول خالص الشكر والتقدير.

${SIGNATURE_BLOCK}`,
  },

  {
    slug: 'charity',
    name: 'قالب الجمعيات الخيرية',
    description: 'صيغة مخاطبة الجمعيات الخيرية لطلبات المساعدة والكفالة.',
    department: 'charities',
    body: `بسم الله الرحمن الرحيم

{{department_addressee}}
حفظه الله

السلام عليكم ورحمة الله وبركاته،،

الموضوع: {{subject}}

{{ai_body}}

جزاكم الله خيراً، وجعل ما تقدمونه في ميزان حسناتكم.

${SIGNATURE_BLOCK}`,
  },
];
