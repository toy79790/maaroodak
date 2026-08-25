import type { QuestionType } from '@prisma/client';
import type {
  ConditionActionName,
  ConditionLogicName,
  ConditionOperator,
} from '@/types/questions';

/**
 * بنك الأسئلة.
 *
 * النطاق يُحدَّد بـ `department` و`requestType` (كلاهما اختياري):
 *   كلاهما null       ⟶ سؤال عام لكل معروض
 *   requestType فقط   ⟶ لكل طلبات هذا النوع أياً كانت الجهة
 *   department فقط    ⟶ لكل طلبات هذه الجهة
 *   كلاهما            ⟶ لهذه الثنائية فقط
 * انظر docs/DATABASE.md §3
 */

export interface OptionSeed {
  value: string;
  label: string;
}

export interface ConditionSeed {
  action?: ConditionActionName;
  logic?: ConditionLogicName;
  clauses: ReadonlyArray<{
    sourceQuestionKey: string;
    operator: ConditionOperator;
    value?: string | number | boolean | string[];
  }>;
}

export interface QuestionSeed {
  key: string;
  label: string;
  description?: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  groupKey?: string;
  order: number;
  options?: readonly OptionSeed[];
  validation?: Record<string, unknown>;
  aiHint?: string;
  /** slug الجهة — null/غياب = كل الجهات */
  department?: string;
  /** slug نوع الطلب — null/غياب = كل الأنواع */
  requestType?: string;
  conditions?: readonly ConditionSeed[];
}

const YES_NO_HINT = 'إجابة بنعم أو لا.';

/* ==========================================================================
   1. أسئلة عامة — تظهر في كل معروض
   ========================================================================== */

const GENERAL: readonly QuestionSeed[] = [
  {
    key: 'applicant_type',
    label: 'من يقدّم هذا المعروض؟',
    type: 'RADIO',
    order: 10,
    options: [
      { value: 'individual', label: 'أنا شخصياً' },
      { value: 'on_behalf', label: 'نيابة عن شخص آخر' },
      { value: 'entity', label: 'باسم منشأة أو جهة' },
    ],
    aiHint:
      'يحدّد ضمير الخطاب في المعروض: «أتقدم» للفرد، «نتقدم» للمنشأة، وذكر صفة النيابة إن كان نيابة عن غيره.',
  },
  {
    key: 'full_name',
    label: 'الاسم الكامل',
    description: 'كما هو مدوّن في الهوية الوطنية.',
    type: 'TEXT',
    order: 11,
    groupKey: 'identity',
    placeholder: 'محمد بن عبدالله السالم',
    validation: { minLength: 3, maxLength: 80 },
    aiHint: 'يُكتب في خانة الاسم أسفل المعروض. لا يُذكر داخل المتن إلا لضرورة.',
  },
  {
    key: 'national_id',
    label: 'رقم الهوية الوطنية',
    type: 'TEXT',
    required: false,
    order: 12,
    groupKey: 'identity',
    placeholder: '1XXXXXXXXX',
    helpText: 'اختياري — يُترك فارغاً إن لم ترغب في ذكره.',
    validation: { pattern: '^[12]\\d{9}$', patternMessage: 'رقم الهوية 10 أرقام يبدأ بـ 1 أو 2' },
    aiHint: 'يُكتب في خانة البيانات أسفل المعروض فقط. لا يُخترع إن كان فارغاً.',
  },
  {
    key: 'phone',
    label: 'رقم الجوال',
    type: 'TEXT',
    order: 13,
    groupKey: 'contact',
    placeholder: '05XXXXXXXX',
    validation: { pattern: '^(?:\\+?966|0)5\\d{8}$', patternMessage: 'رقم جوال سعودي غير صحيح' },
    aiHint: 'خانة البيانات أسفل المعروض.',
  },
  {
    key: 'city',
    label: 'المدينة',
    type: 'TEXT',
    order: 14,
    groupKey: 'contact',
    placeholder: 'الرياض',
    aiHint: 'قد تُذكر في المتن إن كانت ذات صلة بالطلب (مثل قرب الجهة أو بُعدها).',
  },
  {
    key: 'entity_name',
    label: 'اسم المنشأة',
    type: 'TEXT',
    order: 15,
    placeholder: 'مؤسسة ... للتجارة',
    aiHint: 'اسم الجهة مقدّمة الطلب — يُستخدم في المخاطبة بصيغة الجمع.',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'applicant_type', operator: 'EQUALS', value: 'entity' }] },
    ],
  },
  {
    key: 'beneficiary_name',
    label: 'اسم الشخص المستفيد',
    description: 'الشخص الذي تقدّم المعروض نيابة عنه.',
    type: 'TEXT',
    order: 16,
    aiHint: 'يُذكر في المتن مع بيان صفة مقدّم الطلب تجاهه.',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'applicant_type', operator: 'EQUALS', value: 'on_behalf' }] },
    ],
  },
  {
    key: 'relation_to_beneficiary',
    label: 'صلتك بالمستفيد',
    type: 'TEXT',
    order: 17,
    placeholder: 'والده / زوجته / وكيله الشرعي',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'applicant_type', operator: 'EQUALS', value: 'on_behalf' }] },
    ],
  },
  {
    key: 'request_summary',
    label: 'اشرح طلبك باختصار',
    description: 'بكلماتك أنت — سنعيد صياغتها بأسلوب رسمي.',
    type: 'TEXTAREA',
    order: 20,
    placeholder: 'اكتب هنا ما تريد قوله للجهة، بلغتك العادية…',
    helpText: 'كلما كان الشرح أوضح، كان المعروض أدق. لا تقلق بشأن الصياغة.',
    validation: { minLength: 20, maxLength: 2000 },
    aiHint:
      'هذا هو جوهر المعروض. يُعاد صوغه بلغة رسمية رصينة مع الحفاظ الكامل على الوقائع، وتخفيف أي مبالغة.',
  },
  {
    key: 'previous_attempts',
    label: 'هل سبق أن راجعت الجهة في هذا الموضوع؟',
    type: 'YES_NO',
    required: false,
    order: 30,
    aiHint: YES_NO_HINT,
  },
  {
    key: 'previous_attempts_details',
    label: 'ما الذي حدث في مراجعاتك السابقة؟',
    type: 'TEXTAREA',
    required: false,
    order: 31,
    placeholder: 'راجعت الفرع بتاريخ… وأُفيدت بـ…',
    validation: { maxLength: 1000 },
    aiHint:
      'يُذكر في المتن لبيان استنفاد الطرق العادية — عامل مقنع مهم. تُستخدم التواريخ كما ذكرها المستخدم فقط.',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'previous_attempts', operator: 'IS_TRUE' }] },
    ],
  },
  {
    key: 'reference_number',
    label: 'رقم المعاملة أو الطلب السابق',
    type: 'TEXT',
    required: false,
    order: 32,
    placeholder: 'مثال: 4412876',
    helpText: 'إن كان لديك رقم مرجعي، فذكره يُسرّع معالجة طلبك.',
    aiHint:
      'يُذكر في المتن إن وُجد. إن كان فارغاً فلا يُخترع ولا يُوضع رقم افتراضي.',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'previous_attempts', operator: 'IS_TRUE' }] },
    ],
  },
  {
    key: 'attachments_list',
    label: 'ما المستندات التي ستُرفقها مع المعروض؟',
    type: 'CHECKBOX',
    required: false,
    order: 40,
    options: [
      { value: 'id_copy', label: 'صورة الهوية الوطنية' },
      { value: 'family_card', label: 'كرت العائلة' },
      { value: 'salary_certificate', label: 'تعريف بالراتب' },
      { value: 'medical_report', label: 'تقرير طبي' },
      { value: 'debt_statement', label: 'كشف مديونية' },
      { value: 'court_document', label: 'صك أو وثيقة قضائية' },
      { value: 'rent_contract', label: 'عقد إيجار' },
      { value: 'other_docs', label: 'مستندات أخرى' },
    ],
    aiHint:
      'تُذكر في نهاية المعروض كقائمة مرفقات. لا تُذكر مستندات لم يخترها المستخدم.',
  },
];

/* ==========================================================================
   2. أسئلة حسب نوع الطلب
   ========================================================================== */

const BY_REQUEST_TYPE: readonly QuestionSeed[] = [
  // ---------------------------------------------------- مساعدة مالية
  {
    key: 'need_reason',
    label: 'ما سبب حاجتك للمساعدة المالية؟',
    type: 'RADIO',
    order: 100,
    requestType: 'financial-aid',
    options: [
      { value: 'job_loss', label: 'انقطاع الدخل أو فقدان العمل' },
      { value: 'illness', label: 'ظرف صحي' },
      { value: 'debt', label: 'تراكم ديون والتزامات' },
      { value: 'housing', label: 'أعباء سكن' },
      { value: 'family', label: 'ظرف أسري طارئ' },
      { value: 'other', label: 'سبب آخر' },
    ],
    aiHint: 'يحدّد محور الفقرة الأولى من عرض الحال.',
  },
  {
    key: 'need_reason_other',
    label: 'اذكر السبب',
    type: 'TEXT',
    order: 101,
    requestType: 'financial-aid',
    conditions: [
      { clauses: [{ sourceQuestionKey: 'need_reason', operator: 'EQUALS', value: 'other' }] },
    ],
  },
  {
    key: 'monthly_income',
    label: 'ما مقدار دخلك الشهري بالريال؟',
    type: 'NUMBER',
    order: 102,
    requestType: 'financial-aid',
    groupKey: 'finance',
    placeholder: '0',
    helpText: 'اكتب 0 إن لم يكن لديك دخل حالياً.',
    validation: { min: 0, max: 1000000 },
    aiHint: 'يُذكر رقماً كما هو. لا يُقارن بمتوسطات ولا يُوصف بأنه «ضئيل» إلا إن كان صفراً.',
  },
  {
    key: 'family_members',
    label: 'كم عدد أفراد أسرتك الذين تعولهم؟',
    type: 'NUMBER',
    order: 103,
    requestType: 'financial-aid',
    groupKey: 'finance',
    validation: { min: 0, max: 50 },
    aiHint: 'يُذكر رقماً. عامل مقنع مهم عند اقترانه بالدخل.',
  },
  {
    key: 'requested_amount',
    label: 'ما المبلغ الذي تطلبه بالريال؟',
    type: 'NUMBER',
    required: false,
    order: 104,
    requestType: 'financial-aid',
    helpText: 'اختياري — يمكنك ترك تقدير المبلغ للجهة.',
    validation: { min: 0, max: 10000000 },
    aiHint:
      'إن ذُكر فيُطلب صراحةً. إن تُرك فارغاً فالطلب يكون عاماً بلا ذكر أي مبلغ — لا يُخترع رقم.',
  },
  {
    key: 'is_social_security',
    label: 'هل أنت مسجّل في الضمان الاجتماعي؟',
    type: 'YES_NO',
    required: false,
    order: 105,
    requestType: 'financial-aid',
  },

  // ---------------------------------------------------- سداد مديونية
  {
    key: 'has_debt',
    label: 'هل لديك مديونية قائمة؟',
    description: 'إجابتك تحدّد الأسئلة التالية.',
    type: 'YES_NO',
    order: 110,
    requestType: 'debt-settlement',
  },
  {
    key: 'debt_amount',
    label: 'ما قيمة المديونية بالريال؟',
    type: 'NUMBER',
    order: 111,
    requestType: 'debt-settlement',
    validation: { min: 1, max: 100000000 },
    aiHint: 'يُذكر المبلغ رقماً وحروفاً إن كان كبيراً. لا يُقرَّب ولا يُعدَّل.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'creditor_name',
    label: 'ما اسم الجهة الدائنة؟',
    type: 'TEXT',
    order: 112,
    requestType: 'debt-settlement',
    placeholder: 'اسم البنك أو الشخص أو الجهة',
    aiHint: 'يُذكر كما كتبه المستخدم حرفياً. لا يُستبدل ولا يُكمَّل.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'debt_reason',
    label: 'ما سبب هذه المديونية؟',
    type: 'TEXTAREA',
    order: 113,
    requestType: 'debt-settlement',
    placeholder: 'قرض لعلاج… / تمويل سيارة… / التزامات أسرية…',
    validation: { maxLength: 1000 },
    aiHint: 'يُعاد صوغه رسمياً. السبب المشروع يقوّي الطلب.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'debt_duration',
    label: 'منذ متى وهذه المديونية قائمة؟',
    type: 'TEXT',
    order: 114,
    requestType: 'debt-settlement',
    placeholder: 'سنتان تقريباً',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'has_claim',
    label: 'هل توجد مطالبة أو إجراء تنفيذي ضدك؟',
    type: 'YES_NO',
    order: 115,
    requestType: 'debt-settlement',
    aiHint: 'وجود مطالبة يزيد إلحاح الطلب ويُذكر صراحةً.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'claim_details',
    label: 'ما تفاصيل المطالبة؟',
    type: 'TEXTAREA',
    required: false,
    order: 116,
    requestType: 'debt-settlement',
    placeholder: 'صدر أمر تنفيذ بتاريخ… / تم إيقاف الخدمات…',
    validation: { maxLength: 800 },
    aiHint: 'تُذكر الوقائع كما وردت. لا يُذكر رقم صك أو محكمة لم يذكرها المستخدم.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_claim', operator: 'IS_TRUE' }] }],
  },
  {
    key: 'debt_request',
    label: 'ما الذي تطلبه تحديداً؟',
    type: 'RADIO',
    order: 117,
    requestType: 'debt-settlement',
    options: [
      { value: 'full_payment', label: 'سداد المديونية كاملة' },
      { value: 'partial_payment', label: 'سداد جزء من المديونية' },
      { value: 'reschedule', label: 'جدولة الأقساط' },
      { value: 'waiver', label: 'إعفاء من جزء من المبلغ' },
    ],
    aiHint: 'هذا هو الطلب المحدد الذي تُختم به فقرة الطلب. يجب أن يظهر بوضوح.',
    conditions: [{ clauses: [{ sourceQuestionKey: 'has_debt', operator: 'IS_TRUE' }] }],
  },

  // ---------------------------------------------------- إعفاء
  {
    key: 'exemption_subject',
    label: 'ما الذي تطلب الإعفاء منه؟',
    type: 'TEXT',
    order: 120,
    requestType: 'exemption',
    placeholder: 'غرامة تأخير / رسوم تجديد / فوائد تمويل',
    aiHint: 'موضوع الإعفاء يجب أن يظهر في عنوان المعروض وفي فقرة الطلب.',
  },
  {
    key: 'exemption_amount',
    label: 'ما مقدار المبلغ بالريال؟',
    type: 'NUMBER',
    required: false,
    order: 121,
    requestType: 'exemption',
    validation: { min: 0, max: 10000000 },
  },
  {
    key: 'exemption_reason',
    label: 'لماذا تستحق الإعفاء؟',
    type: 'TEXTAREA',
    order: 122,
    requestType: 'exemption',
    validation: { minLength: 15, maxLength: 1200 },
    aiHint: 'الأساس المقنع للطلب. يُعاد صوغه بلغة موضوعية.',
  },

  // ---------------------------------------------------- علاج
  {
    key: 'patient_is_self',
    label: 'هل الطلب لعلاجك أنت؟',
    type: 'YES_NO',
    order: 130,
    requestType: 'treatment',
  },
  {
    key: 'patient_name',
    label: 'اسم المريض',
    type: 'TEXT',
    order: 131,
    requestType: 'treatment',
    conditions: [{ clauses: [{ sourceQuestionKey: 'patient_is_self', operator: 'IS_FALSE' }] }],
  },
  {
    key: 'condition_description',
    label: 'ما الحالة الصحية؟',
    description: 'اكتب ما ورد في التقرير الطبي أو ما أخبرك به الطبيب.',
    type: 'TEXTAREA',
    order: 132,
    requestType: 'treatment',
    validation: { minLength: 10, maxLength: 1500 },
    aiHint:
      'تُنقل الحالة كما ذكرها المستخدم فقط. يُمنع منعاً باتاً إضافة تشخيص أو مصطلح طبي أو نسبة خطورة من عند النموذج.',
  },
  {
    key: 'condition_duration',
    label: 'منذ متى وأنت تعاني من هذه الحالة؟',
    type: 'TEXT',
    required: false,
    order: 133,
    requestType: 'treatment',
    placeholder: 'ثمانية أشهر',
  },
  {
    key: 'treatment_needed',
    label: 'ما العلاج أو الإجراء المطلوب؟',
    type: 'TEXTAREA',
    order: 134,
    requestType: 'treatment',
    placeholder: 'عملية جراحية / تحويل لمستشفى تخصصي / تغطية تكاليف دواء',
    validation: { maxLength: 1000 },
  },
  {
    key: 'treatment_obstacle',
    label: 'ما الذي يمنعك من الحصول عليه حالياً؟',
    type: 'TEXTAREA',
    order: 135,
    requestType: 'treatment',
    validation: { maxLength: 1000 },
    aiHint: 'بيان العائق هو ما يبرّر توجيه الطلب لهذه الجهة تحديداً.',
  },

  // ---------------------------------------------------- وظيفة
  {
    key: 'job_title',
    label: 'ما الوظيفة التي تتقدم لها؟',
    type: 'TEXT',
    order: 140,
    requestType: 'employment',
    placeholder: 'محاسب / فني صيانة / معلم',
  },
  {
    key: 'qualification',
    label: 'ما مؤهلك العلمي؟',
    type: 'SELECT',
    order: 141,
    requestType: 'employment',
    groupKey: 'career',
    options: [
      { value: 'high_school', label: 'ثانوية عامة' },
      { value: 'diploma', label: 'دبلوم' },
      { value: 'bachelor', label: 'بكالوريوس' },
      { value: 'master', label: 'ماجستير' },
      { value: 'phd', label: 'دكتوراه' },
      { value: 'other', label: 'أخرى' },
    ],
  },
  {
    key: 'experience_years',
    label: 'كم سنة خبرة لديك؟',
    type: 'NUMBER',
    required: false,
    order: 142,
    requestType: 'employment',
    groupKey: 'career',
    validation: { min: 0, max: 60 },
  },
  {
    key: 'specialization',
    label: 'ما تخصصك؟',
    type: 'TEXT',
    required: false,
    order: 143,
    requestType: 'employment',
    placeholder: 'محاسبة / هندسة كهربائية',
  },
  {
    key: 'is_currently_employed',
    label: 'هل تعمل حالياً؟',
    type: 'YES_NO',
    required: false,
    order: 144,
    requestType: 'employment',
  },

  // ---------------------------------------------------- نقل
  {
    key: 'transfer_from',
    label: 'من أين تريد النقل؟',
    type: 'TEXT',
    order: 150,
    requestType: 'transfer',
    groupKey: 'transfer',
  },
  {
    key: 'transfer_to',
    label: 'وإلى أين؟',
    type: 'TEXT',
    order: 151,
    requestType: 'transfer',
    groupKey: 'transfer',
  },
  {
    key: 'transfer_reason',
    label: 'ما سبب طلب النقل؟',
    type: 'RADIO',
    order: 152,
    requestType: 'transfer',
    options: [
      { value: 'health', label: 'ظرف صحي' },
      { value: 'family', label: 'ظرف أسري' },
      { value: 'distance', label: 'بُعد المسافة' },
      { value: 'work', label: 'ظرف وظيفي' },
      { value: 'other', label: 'سبب آخر' },
    ],
  },
  {
    key: 'transfer_reason_details',
    label: 'اشرح السبب بالتفصيل',
    type: 'TEXTAREA',
    order: 153,
    requestType: 'transfer',
    validation: { maxLength: 1200 },
  },

  // ---------------------------------------------------- ترقية
  {
    key: 'current_position',
    label: 'ما وظيفتك الحالية ومرتبتها؟',
    type: 'TEXT',
    order: 160,
    requestType: 'promotion',
  },
  {
    key: 'service_years',
    label: 'كم سنة قضيت في هذه الوظيفة؟',
    type: 'NUMBER',
    order: 161,
    requestType: 'promotion',
    validation: { min: 0, max: 60 },
  },
  {
    key: 'achievements',
    label: 'ما أبرز إنجازاتك في العمل؟',
    type: 'TEXTAREA',
    order: 162,
    requestType: 'promotion',
    validation: { maxLength: 1500 },
    aiHint: 'تُذكر الإنجازات كما وردت. لا تُضاف إنجازات ولا تُضخَّم.',
  },

  // ---------------------------------------------------- سكن
  {
    key: 'housing_status',
    label: 'ما وضعك السكني الحالي؟',
    type: 'RADIO',
    order: 170,
    requestType: 'housing',
    options: [
      { value: 'rent', label: 'سكن بالإيجار' },
      { value: 'family', label: 'أسكن مع الأهل' },
      { value: 'temporary', label: 'سكن مؤقت' },
      { value: 'none', label: 'بلا سكن مستقر' },
    ],
  },
  {
    key: 'rent_amount',
    label: 'ما قيمة الإيجار السنوي بالريال؟',
    type: 'NUMBER',
    order: 171,
    requestType: 'housing',
    validation: { min: 0, max: 5000000 },
    conditions: [
      { clauses: [{ sourceQuestionKey: 'housing_status', operator: 'EQUALS', value: 'rent' }] },
    ],
  },
  {
    key: 'owns_property',
    label: 'هل تملك أي عقار؟',
    type: 'YES_NO',
    order: 172,
    requestType: 'housing',
    aiHint: 'عدم التملك شرط جوهري في أغلب برامج الدعم السكني ويُذكر صراحةً.',
  },

  // ---------------------------------------------------- أرض
  {
    key: 'land_purpose',
    label: 'ما الغرض من الأرض؟',
    type: 'RADIO',
    order: 180,
    requestType: 'land',
    options: [
      { value: 'residential', label: 'بناء سكن' },
      { value: 'agricultural', label: 'زراعي' },
      { value: 'commercial', label: 'تجاري' },
    ],
  },
  {
    key: 'preferred_location',
    label: 'في أي منطقة تفضّل الأرض؟',
    type: 'TEXT',
    required: false,
    order: 181,
    requestType: 'land',
  },

  // ---------------------------------------------------- منحة دراسية
  {
    key: 'study_level',
    label: 'ما المرحلة الدراسية المطلوبة؟',
    type: 'SELECT',
    order: 190,
    requestType: 'scholarship',
    options: [
      { value: 'bachelor', label: 'بكالوريوس' },
      { value: 'master', label: 'ماجستير' },
      { value: 'phd', label: 'دكتوراه' },
      { value: 'diploma', label: 'دبلوم' },
      { value: 'course', label: 'دورة تدريبية' },
    ],
  },
  {
    key: 'study_major',
    label: 'ما التخصص؟',
    type: 'TEXT',
    order: 191,
    requestType: 'scholarship',
    groupKey: 'study',
  },
  {
    key: 'gpa',
    label: 'ما معدلك التراكمي؟',
    type: 'TEXT',
    required: false,
    order: 192,
    requestType: 'scholarship',
    groupKey: 'study',
    placeholder: '4.5 من 5',
  },

  // ---------------------------------------------------- استثناء
  {
    key: 'exception_from',
    label: 'ما الشرط أو الإجراء المطلوب الاستثناء منه؟',
    type: 'TEXT',
    order: 200,
    requestType: 'exception',
  },
  {
    key: 'exception_reason',
    label: 'ما الظرف الذي منعك من استيفائه؟',
    type: 'TEXTAREA',
    order: 201,
    requestType: 'exception',
    validation: { minLength: 15, maxLength: 1200 },
    aiHint: 'الظرف الخارج عن الإرادة هو أقوى أساس لطلب الاستثناء ويُبرز في المتن.',
  },

  // ---------------------------------------------------- شكوى
  {
    key: 'complaint_subject',
    label: 'ما موضوع الشكوى؟',
    type: 'TEXT',
    order: 210,
    requestType: 'complaint',
    placeholder: 'تأخر إنجاز معاملة / سوء خدمة / خطأ في فاتورة',
  },
  {
    key: 'incident_date',
    label: 'متى وقعت الحادثة؟',
    type: 'DATE',
    required: false,
    order: 211,
    requestType: 'complaint',
    validation: { dateRange: 'past' },
    aiHint: 'يُذكر التاريخ كما أُدخل. إن كان فارغاً فلا يُخترع تاريخ.',
  },
  {
    key: 'incident_details',
    label: 'اسرد ما حدث بالترتيب',
    type: 'TEXTAREA',
    order: 212,
    requestType: 'complaint',
    validation: { minLength: 20, maxLength: 2000 },
    aiHint:
      'يُعاد سرد الوقائع بترتيب زمني ولغة موضوعية. لا تُوجَّه اتهامات لأشخاص بأسمائهم، ولا يُضاف حكم قيمي.',
  },
  {
    key: 'complaint_impact',
    label: 'ما الضرر الذي لحق بك؟',
    type: 'TEXTAREA',
    required: false,
    order: 213,
    requestType: 'complaint',
    validation: { maxLength: 1000 },
  },
  {
    key: 'desired_resolution',
    label: 'ما المعالجة التي تطلبها؟',
    type: 'TEXTAREA',
    order: 214,
    requestType: 'complaint',
    validation: { maxLength: 800 },
    aiHint: 'شكوى بلا طلب محدد ضعيفة. يُبرز المطلوب في الفقرة الأخيرة.',
  },

  // ---------------------------------------------------- تظلم
  {
    key: 'decision_subject',
    label: 'ما القرار الذي تتظلم منه؟',
    type: 'TEXT',
    order: 220,
    requestType: 'grievance',
    placeholder: 'قرار إنهاء خدمة / حسم من الراتب / رفض طلب',
  },
  {
    key: 'decision_date',
    label: 'ما تاريخ القرار؟',
    type: 'DATE',
    required: false,
    order: 221,
    requestType: 'grievance',
    groupKey: 'decision',
    validation: { dateRange: 'past' },
  },
  {
    key: 'decision_number',
    label: 'ما رقم القرار؟',
    type: 'TEXT',
    required: false,
    order: 222,
    requestType: 'grievance',
    groupKey: 'decision',
    aiHint: 'إن تُرك فارغاً فلا يُخترع رقم — يُشار إلى القرار بموضوعه وتاريخه.',
  },
  {
    key: 'grievance_grounds',
    label: 'لماذا ترى أن القرار غير صحيح أو أضرّ بك؟',
    type: 'TEXTAREA',
    order: 223,
    requestType: 'grievance',
    validation: { minLength: 20, maxLength: 2000 },
    aiHint:
      'أساس التظلم. يُصاغ بلغة رصينة. يُمنع الاستشهاد بأي نظام أو مادة لم يذكرها المستخدم.',
  },

  // ---------------------------------------------------- اعتراض
  {
    key: 'objection_subject',
    label: 'ما موضوع الاعتراض؟',
    type: 'TEXT',
    order: 230,
    requestType: 'objection',
    placeholder: 'مخالفة مرورية / مبلغ فاتورة / نتيجة تقييم',
  },
  {
    key: 'objection_reference',
    label: 'ما رقم المخالفة أو المرجع؟',
    type: 'TEXT',
    required: false,
    order: 231,
    requestType: 'objection',
  },
  {
    key: 'objection_grounds',
    label: 'ما سبب اعتراضك؟',
    type: 'TEXTAREA',
    order: 232,
    requestType: 'objection',
    validation: { minLength: 15, maxLength: 1500 },
  },

  // ---------------------------------------------------- إعادة نظر
  {
    key: 'rejected_request',
    label: 'ما الطلب الذي رُفض؟',
    type: 'TEXT',
    order: 240,
    requestType: 'reconsideration',
  },
  {
    key: 'rejection_reason',
    label: 'ما سبب الرفض كما أُبلغت به؟',
    type: 'TEXTAREA',
    required: false,
    order: 241,
    requestType: 'reconsideration',
    validation: { maxLength: 1000 },
  },
  {
    key: 'new_information',
    label: 'ما الجديد الذي تقدّمه الآن؟',
    description: 'معلومة أو مستند أو ظرف لم يكن معروضاً عند القرار الأول.',
    type: 'TEXTAREA',
    order: 242,
    requestType: 'reconsideration',
    validation: { minLength: 15, maxLength: 1500 },
    aiHint:
      'هذا هو مبرّر إعادة النظر. إن لم يوجد جديد، يُصاغ الطلب على أساس إعادة تقدير الظرف لا على أساس معلومة جديدة.',
  },

  // ---------------------------------------------------- رفع ضرر
  {
    key: 'harm_description',
    label: 'ما الضرر الواقع عليك؟',
    type: 'TEXTAREA',
    order: 250,
    requestType: 'harm-removal',
    validation: { minLength: 20, maxLength: 1800 },
  },
  {
    key: 'harm_source',
    label: 'ما مصدر الضرر؟',
    type: 'TEXT',
    order: 251,
    requestType: 'harm-removal',
    placeholder: 'ورشة مجاورة / حفريات / انقطاع خدمة',
  },
  {
    key: 'harm_duration',
    label: 'منذ متى وهذا الضرر قائم؟',
    type: 'TEXT',
    required: false,
    order: 252,
    requestType: 'harm-removal',
  },

  // ---------------------------------------------------- إصلاح وضع
  {
    key: 'current_situation',
    label: 'ما الوضع الحالي الذي تريد تصحيحه؟',
    type: 'TEXTAREA',
    order: 260,
    requestType: 'situation-fix',
    validation: { minLength: 20, maxLength: 1500 },
  },
  {
    key: 'desired_situation',
    label: 'ما الوضع الصحيح المطلوب؟',
    type: 'TEXTAREA',
    order: 261,
    requestType: 'situation-fix',
    validation: { minLength: 10, maxLength: 1000 },
  },

  // ---------------------------------------------------- مقابلة
  {
    key: 'meeting_topic',
    label: 'ما موضوع المقابلة؟',
    type: 'TEXTAREA',
    order: 270,
    requestType: 'meeting',
    validation: { minLength: 15, maxLength: 800 },
  },
  {
    key: 'meeting_why_in_person',
    label: 'لماذا تحتاج مقابلة شخصية؟',
    type: 'TEXTAREA',
    required: false,
    order: 271,
    requestType: 'meeting',
    validation: { maxLength: 600 },
  },

  // ---------------------------------------------------- دعم / منحة
  {
    key: 'support_purpose',
    label: 'ما الغرض من الدعم؟',
    type: 'TEXTAREA',
    order: 280,
    requestType: 'support',
    validation: { minLength: 15, maxLength: 1500 },
  },
  {
    key: 'support_impact',
    label: 'ما الأثر المتوقع من هذا الدعم؟',
    type: 'TEXTAREA',
    required: false,
    order: 281,
    requestType: 'support',
    validation: { maxLength: 1000 },
  },
  {
    key: 'grant_purpose',
    label: 'ما الغرض من المنحة؟',
    type: 'TEXTAREA',
    order: 290,
    requestType: 'grant',
    validation: { minLength: 15, maxLength: 1200 },
  },
];

/* ==========================================================================
   3. أسئلة خاصة بجهات محدّدة
   ========================================================================== */

const BY_DEPARTMENT: readonly QuestionSeed[] = [
  {
    key: 'other_department_name',
    label: 'ما اسم الجهة التي تريد مخاطبتها؟',
    description: 'اكتب الاسم الرسمي للجهة كما تعرفه.',
    type: 'TEXT',
    order: 5,
    department: 'other',
    placeholder: 'مثال: الهيئة العامة للعقار',
    aiHint:
      'يُستخدم في سطر المخاطبة أعلى المعروض بدل الاسم الافتراضي.',
  },
  {
    key: 'bank_name',
    label: 'ما اسم البنك؟',
    type: 'TEXT',
    order: 6,
    department: 'banks',
    placeholder: 'مثال: بنك الرياض',
  },
  {
    key: 'bank_account_last4',
    label: 'آخر أربعة أرقام من رقم الحساب',
    type: 'TEXT',
    required: false,
    order: 7,
    department: 'banks',
    helpText: 'اختياري — لا تكتب رقم الحساب كاملاً.',
    validation: { pattern: '^\\d{4}$', patternMessage: 'أربعة أرقام فقط' },
    aiHint: 'يُذكر بصيغة «الحساب المنتهي بـ XXXX» فقط. لا يُطلب رقم كامل أبداً.',
  },
  {
    key: 'university_name',
    label: 'ما اسم الجامعة؟',
    type: 'TEXT',
    order: 6,
    department: 'universities',
    groupKey: 'university',
  },
  {
    key: 'student_id',
    label: 'الرقم الجامعي',
    type: 'TEXT',
    required: false,
    order: 7,
    department: 'universities',
    groupKey: 'university',
  },
  {
    key: 'school_name',
    label: 'ما اسم المدرسة؟',
    type: 'TEXT',
    order: 6,
    department: 'schools',
  },
  {
    key: 'company_name',
    label: 'ما اسم الشركة؟',
    type: 'TEXT',
    order: 6,
    department: 'companies',
  },
  {
    key: 'emirate_region',
    label: 'ما المنطقة؟',
    type: 'TEXT',
    order: 6,
    department: 'regional-emirates',
    placeholder: 'منطقة الرياض',
    aiHint: 'تُستخدم في سطر المخاطبة: «صاحب السمو الملكي أمير منطقة …».',
  },
  {
    key: 'telecom_provider',
    label: 'ما مزوّد الخدمة؟',
    type: 'TEXT',
    order: 6,
    department: 'telecom-companies',
  },
  {
    key: 'insurance_company',
    label: 'ما شركة التأمين؟',
    type: 'TEXT',
    order: 6,
    department: 'insurance-companies',
  },
  {
    key: 'finance_company',
    label: 'ما اسم شركة التمويل؟',
    type: 'TEXT',
    order: 6,
    department: 'finance-companies',
  },
  {
    key: 'charity_name',
    label: 'ما اسم الجمعية؟',
    type: 'TEXT',
    order: 6,
    department: 'charities',
  },
];

/* ==========================================================================
   4. أسئلة خاصة بثنائية (جهة + نوع طلب)
   ========================================================================== */

const BY_PAIR: readonly QuestionSeed[] = [
  {
    key: 'royal_court_urgency',
    label: 'ما الذي يجعل طلبك عاجلاً؟',
    description:
      'المعاريض المرفوعة للمقام السامي غالباً تخص حالات استُنفدت فيها الطرق الأخرى.',
    type: 'TEXTAREA',
    order: 300,
    department: 'royal-court',
    requestType: 'financial-aid',
    validation: { minLength: 20, maxLength: 1200 },
    aiHint:
      'يُبرز في المتن سبب رفع الطلب للمقام السامي تحديداً، مع بيان ما جُرّب قبله.',
  },
  {
    key: 'housing_support_status',
    label: 'ما وضعك في منصة سكني؟',
    type: 'RADIO',
    required: false,
    order: 310,
    department: 'ministry-housing',
    requestType: 'housing',
    options: [
      { value: 'registered', label: 'مسجّل وفي قائمة الانتظار' },
      { value: 'rejected', label: 'قُدّم الطلب ورُفض' },
      { value: 'not_registered', label: 'غير مسجّل' },
    ],
  },
  {
    key: 'bank_debt_installment',
    label: 'ما قيمة القسط الشهري الحالي بالريال؟',
    type: 'NUMBER',
    required: false,
    order: 320,
    department: 'banks',
    requestType: 'debt-settlement',
    validation: { min: 0, max: 1000000 },
    aiHint: 'مقارنة القسط بالدخل عامل مقنع في طلبات الجدولة.',
  },
];

export const QUESTIONS: readonly QuestionSeed[] = [
  ...GENERAL,
  ...BY_REQUEST_TYPE,
  ...BY_DEPARTMENT,
  ...BY_PAIR,
];
