export interface PlanSeed {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  lettersPerMonth: number;
  creditsPerMonth: number;
  features: readonly string[];
  isPopular?: boolean;
  order: number;
}

export const PLANS: readonly PlanSeed[] = [
  {
    key: 'free',
    name: 'مجاني',
    description: 'لتجربة المنصة وكتابة معروضك الأول.',
    priceMonthly: 0,
    lettersPerMonth: 3,
    creditsPerMonth: 3,
    order: 1,
    features: [
      'كل الجهات وأنواع الطلبات',
      'المقابلة الذكية كاملة',
      'تحميل PDF و Word',
      'حفظ المعاريض والمسودات',
    ],
  },
  {
    key: 'basic',
    name: 'أساسي',
    description: 'للاستخدام الشخصي المتكرر.',
    priceMonthly: 49,
    lettersPerMonth: 20,
    creditsPerMonth: 25,
    order: 2,
    features: [
      'كل مزايا الخطة المجانية',
      'أدوات التحرير بالذكاء الاصطناعي',
      'فحص الجودة التلقائي',
      'سجل النسخ الكامل',
      'المفضلة والبحث المتقدم',
    ],
  },
  {
    key: 'pro',
    name: 'احترافي',
    description: 'للمكاتب والمعقّبين وأصحاب الاستخدام الكثيف.',
    priceMonthly: 149,
    lettersPerMonth: 100,
    creditsPerMonth: 130,
    isPopular: true,
    order: 3,
    features: [
      'كل مزايا الخطة الأساسية',
      'أولوية في المعالجة',
      'أسئلة متابعة ذكية غير محدودة',
      'قوالب مخصّصة',
      'دعم فني مباشر',
    ],
  },
  {
    key: 'business',
    name: 'أعمال',
    description: 'للمنشآت والفرق التي تكتب خطابات بشكل يومي.',
    priceMonthly: 499,
    lettersPerMonth: 1000,
    creditsPerMonth: 1200,
    order: 4,
    features: [
      'كل مزايا الخطة الاحترافية',
      'حسابات متعددة للفريق',
      'جهات وقوالب خاصة بمنشأتك',
      'تقارير استخدام',
      'مدير حساب مخصّص',
    ],
  },
];

/** إعدادات النظام الافتراضية — قابلة للتعديل من لوحة التحكم. */
export const SYSTEM_SETTINGS: ReadonlyArray<{
  key: string;
  value: unknown;
  category: string;
}> = [
  { key: 'platform.name', value: 'معروضك', category: 'general' },
  { key: 'platform.logoUrl', value: '', category: 'general' },
  { key: 'platform.supportEmail', value: 'support@maroudak.sa', category: 'general' },
  { key: 'credits.signupBonus', value: 3, category: 'credits' },
  { key: 'credits.costs.generate', value: 1, category: 'credits' },
  { key: 'credits.costs.aiTool', value: 1, category: 'credits' },
  { key: 'credits.costs.regenerate', value: 1, category: 'credits' },
  { key: 'credits.costs.followUp', value: 1, category: 'credits' },
  { key: 'credits.costs.qualityCheck', value: 1, category: 'credits' },
  { key: 'ai.model.generate', value: 'claude-opus-5', category: 'ai' },
  { key: 'ai.model.tools', value: 'claude-sonnet-5', category: 'ai' },
  { key: 'ai.model.quality', value: 'claude-opus-5', category: 'ai' },
  { key: 'ai.model.followUp', value: 'claude-sonnet-5', category: 'ai' },
  { key: 'ai.effort.generate', value: 'high', category: 'ai' },
  { key: 'ai.effort.tools', value: 'medium', category: 'ai' },
  { key: 'ai.maxTokens.generate', value: 8000, category: 'ai' },
  { key: 'ai.maxTokens.tools', value: 4000, category: 'ai' },
  { key: 'ai.qualityCheck.enabled', value: true, category: 'ai' },
  { key: 'ai.followUp.enabled', value: true, category: 'ai' },
  { key: 'limits.generatePerWindow', value: 5, category: 'limits' },
  { key: 'limits.aiToolPerWindow', value: 20, category: 'limits' },
];
