# ARCHITECTURE — معروضك

## 1. المبدأ الحاكم

> **منطق الأعمال لا يعرف شيئاً عن Next.js.**

كل ما هو جوهري في المنتج (محرك الأسئلة، الشروط، القوالب، بناء الـ Prompt، فحص الجودة، حساب الـ Credits)
مكتوب كـ **دوال وخدمات نقية في `src/services/`** لا تستورد `next/*` ولا `@prisma/client` مباشرة.
النتيجة: قابلية اختبار كاملة، وإمكانية نقل المحرك لاحقاً إلى API مستقل أو Worker دون إعادة كتابة.

---

## 2. الطبقات

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Presentation      app/ · components/ · features/*/components│
│    RSC + Client Components. لا منطق أعمال. لا استعلامات مباشرة.│
├──────────────────────────────────────────────────────────────┤
│ 2. Application       app/api/* · features/*/actions.ts        │
│    رقيقة: auth → validate(zod) → rate-limit → service → map   │
├──────────────────────────────────────────────────────────────┤
│ 3. Domain Services   services/**                              │
│    QuestionEngine · ConditionEvaluator · TemplateEngine       │
│    AIService · PromptBuilder · Guardrails · QualityChecker    │
│    CreditService · ExportService                              │
│    ❗ نقية: لا Next، لا Prisma، لا I/O مباشر (Ports فقط)      │
├──────────────────────────────────────────────────────────────┤
│ 4. Data Access       lib/db/repositories/**                   │
│    Prisma فقط هنا. كل استعلام يفرض tenant scope.              │
├──────────────────────────────────────────────────────────────┤
│ 5. Infrastructure    lib/ai/providers · lib/mail · lib/security│
│    Anthropic SDK · Rate limiter · Hashing · Session           │
└──────────────────────────────────────────────────────────────┘
```

**قاعدة الاعتماد:** الأعلى يعتمد على الأدنى فقط. الطبقة 3 تعرّف واجهات (Ports) وتحقنها الطبقة 2.

---

## 3. بنية المجلدات

```
معروضي/
├─ docs/                      ← كل الوثائق
├─ prisma/
│  ├─ schema.prisma
│  ├─ seed.ts
│  └─ seed-data/              ← بيانات الجهات/الأسئلة/القوالب/الـ Prompts (TS مُوثّق النوع)
├─ scripts/
│  └─ db-server.ts            ← تشغيل PostgreSQL محلي مضمّن
├─ public/
├─ tests/
│  ├─ unit/                   ← Vitest — الخدمات النقية
│  ├─ integration/            ← Vitest — API + DB حقيقية
│  └─ e2e/                    ← Playwright — الرحلة الكاملة
└─ src/
   ├─ app/
   │  ├─ (marketing)/         ← / · /pricing · /faq · /privacy · /terms
   │  ├─ (auth)/              ← /login · /register · /forgot-password · /reset-password
   │  ├─ (app)/               ← 🔒 /dashboard · /letters · /new · /favorites · /settings
   │  ├─ (admin)/admin/       ← 🔒🛡 لوحة التحكم
   │  └─ api/                 ← Route Handlers
   ├─ components/
   │  ├─ ui/                  ← primitives: Button, Input, Select, Dialog, …
   │  ├─ layout/              ← AppSidebar, AppTopbar, MarketingHeader, Footer
   │  └─ shared/              ← EmptyState, ErrorState, LoadingState, PageHeader, DataTable
   ├─ features/               ← وحدات المنتج (كل واحدة مكتفية بذاتها)
   │  ├─ auth/  departments/  interview/  letters/  editor/
   │  ├─ export/  admin/  billing/  analytics/
   │  └─ <feature>/{components,actions.ts,queries.ts,schema.ts,types.ts}
   ├─ services/               ← ❤️ منطق الأعمال النقي
   │  ├─ questions/{engine.ts,conditions.ts,validation.ts}
   │  ├─ templates/{engine.ts,variables.ts}
   │  ├─ ai/{ai-service.ts,prompt-builder.ts,guardrails.ts,quality-checker.ts,
   │  │       follow-up.ts,tools.ts,providers/,ports.ts}
   │  ├─ export/{pdf.ts,docx.ts,paper.ts}
   │  ├─ credits/credit-service.ts
   │  └─ analytics/analytics-service.ts
   ├─ lib/
   │  ├─ db/{prisma.ts,repositories/*}
   │  ├─ auth/{session.ts,password.ts,rbac.ts,guards.ts}
   │  ├─ security/{rate-limit.ts,csrf.ts,sanitize.ts,headers.ts}
   │  ├─ api/{handler.ts,errors.ts,response.ts}
   │  └─ utils/{cn.ts,date.ts,format.ts,arabic.ts}
   ├─ config/                 ← env.ts · site.ts · constants.ts · nav.ts
   ├─ hooks/
   └─ types/
```

---

## 4. تدفّق البيانات — الرحلة الأساسية

```
[Client]                 [Application]              [Domain]              [Data]
اختيار جهة  ──────────▶ GET /api/departments ────────────────────────▶ DepartmentRepo
اختيار نوع  ──────────▶ GET /api/request-types?departmentId
                                    │
بدء المقابلة ─────────▶ POST /api/interview/start
                                    │  ┌──────────────────────────────┐
                                    ├─▶│ QuestionEngine.buildPlan()   │◀── QuestionRepo
                                    │  │  · يجلب أسئلة النطاق         │    ConditionRepo
                                    │  │  · يبني DAG الشروط           │
                                    │  │  · يُرجع أول سؤال مرئي        │
                                    │  └──────────────────────────────┘
                                    └─▶ InterviewSession (DB)

كل إجابة ────────────▶ PATCH /api/interview/:id/answer
                                    ├─▶ validateAnswer(question, value)   [Zod ديناميكي]
                                    ├─▶ engine.next(answers)  ← يُعيد حساب المرئي
                                    └─▶ حفظ تلقائي للمسودة

مراجعة ─────────────▶ POST /api/interview/:id/follow-up (اختياري)
                                    └─▶ AIService.detectGaps()  ← أسئلة إضافية مقترحة

توليد ──────────────▶ POST /api/letters/generate
                        ├─ CreditService.assertCanSpend(user, GENERATE)
                        ├─ TemplateEngine.resolve(dept, type)
                        ├─ PromptBuilder.build({dept,type,answers,template,prompts})
                        ├─ AIService.generate() ────────────▶ Anthropic
                        ├─ Guardrails.scan(output, answers)  ← كشف الاختراع
                        ├─ QualityChecker.run(output, ctx)   ← 8 فحوص
                        ├─ CreditService.spend() + AIUsage.record()
                        └─ Letter + LetterVersion(v1, AI_GENERATED)

تعديل ──────────────▶ PATCH /api/letters/:id  → LetterVersion(v+1, USER_EDIT)
أداة AI ────────────▶ POST /api/letters/:id/ai-tool → LetterVersion(v+1, AI_TOOL)
تصدير ──────────────▶ GET  /api/letters/:id/export?format=pdf|docx
```

---

## 5. Question Engine — التصميم

الوحدة الأهم. **نقية تماماً** (`services/questions/engine.ts`): تستقبل مصفوفة أسئلة + شروط + إجابات، وتُرجع الحالة.

```ts
type EngineInput = {
  questions: QuestionDef[];      // مُرتّبة
  conditions: ConditionRule[];
  answers: AnswerMap;
};

type EngineState = {
  visible: QuestionDef[];        // الأسئلة المرئية الآن بعد تقييم الشروط
  steps: Step[];                 // تجميع الأسئلة في خطوات (1–2 لكل شاشة)
  currentStepIndex: number;
  totalSteps: number;            // ديناميكي — يتغيّر مع الإجابات
  progress: number;              // 0..1
  isComplete: boolean;
  missingRequired: QuestionDef[];
};
```

**قرارات التصميم:**

1. **إعادة الحساب الكاملة (Full recompute)** بعد كل إجابة — لا حالة تراكمية.
   أبسط، أسلم، وقابل للاختبار بمدخل واحد.
2. **الشروط رسم بياني موجّه (DAG)** — يُكشف وجود دورة (cycle) عند الحفظ في لوحة التحكم ويُرفض.
3. **الإجابات المخفية لا تُحذف بل تُستبعد** — لو رجع المستخدم وغيّر «لا» إلى «نعم» تعود إجاباته السابقة.
   لكن **لا تُرسل للـ AI** إلا الإجابات المرئية.
4. **التقدّم صادق** — `totalSteps` يُعاد حسابه، فلا يرى المستخدم «3 من 9» ثم تقفز إلى 14 فجأة.
5. **الخطوة قد تحوي سؤالين** إذا كانا مرتبطين (`groupKey` مشترك) وكلاهما قصير.

### تقييم الشروط

```
ConditionRule {
  targetQuestionKey   // السؤال المتأثر
  action              // SHOW | HIDE | REQUIRE | OPTIONAL
  logic               // AND | OR
  clauses: [{ sourceQuestionKey, operator, value }]
}
```
`operator`: `EQUALS · NOT_EQUALS · IN · NOT_IN · CONTAINS · GT · GTE · LT · LTE · IS_EMPTY · IS_NOT_EMPTY · IS_TRUE · IS_FALSE`

الافتراضي: السؤال مرئي ما لم توجد قاعدة `SHOW` عليه — عندها يُخفى حتى تتحقق.
لو كان مصدر الشرط نفسه **مخفياً** → الشرط لا يتحقق (انتشار الإخفاء نحو الأسفل).

---

## 6. Template Engine

قالب = نص فيه `{{variable}}` + كتل شرطية `{{#if var}}…{{/if}}`.
**لا نستخدم Handlebars ولا eval** — محرك صغير خاص، آمن، بلا تنفيذ كود.

المتغيرات ثلاث فئات:
- **System**: `{{today}}`, `{{today_hijri}}`, `{{platform_name}}`
- **User**: `{{full_name}}`, `{{national_id}}`, `{{phone}}`, `{{city}}`
- **Answers**: `{{a.<question_key>}}` — كل إجابة متاحة بمفتاحها
- **AI Slot**: `{{ai_body}}` — الموضع الذي يملؤه الذكاء الاصطناعي

هذا هو المفتاح لـ «ديناميكي وليس نموذجاً ثابتاً»: القالب يحدّد **الهيكل الرسمي**،
والـ AI يكتب **المحتوى** داخل `{{ai_body}}` بناءً على الجهة ونوع الطلب والإجابات.

---

## 7. AI Layer — الحدود

```
services/ai/ports.ts        ← interface LLMProvider  (لا SDK هنا)
services/ai/providers/anthropic.ts  ← التنفيذ الوحيد v1
services/ai/prompt-builder.ts       ← نقي: (ctx) => {system, user}
services/ai/guardrails.ts           ← نقي: (output, answers) => Violation[]
services/ai/quality-checker.ts      ← يستخدم LLMProvider (فحص دلالي) + فحوص نقية
services/ai/ai-service.ts           ← التنسيق (orchestration)
```

`LLMProvider` واجهة واحدة → إضافة OpenAI لاحقاً = ملف واحد، بلا تغيير في أي مكان آخر.
مفاتيح الـ API **لا تصل المتصفح إطلاقاً** — كل نداء عبر Route Handler على الخادم.

---

## 8. Multi-Tenancy

نموذج **Shared Database / Shared Schema + Discriminator**.

- كل جدول قابل للتخصيص يحمل `organizationId: String?`
- `organizationId = null` ⇒ **سجل نظام عام** (الجهات والأسئلة والقوالب الافتراضية) يراه الجميع
- `organizationId = X` ⇒ سجل خاص بالمنظمة X، يحجب النظير العام عبر `slug` مطابق

**الفرض (Enforcement):** لا يستدعي أي كود `prisma.<model>.findMany` مباشرة خارج `lib/db/repositories`.
كل Repository يستقبل `TenantContext { userId, organizationId, role }` ويحقن الفلتر.
اختبار تكامل مخصص يتحقق من عدم تسرّب البيانات بين منظمتين.

---

## 9. التوجيه والحماية

| المجموعة | الحماية |
|---|---|
| `(marketing)` | عامة — Static/ISR |
| `(auth)` | عامة — تعيد التوجيه للـ dashboard إن كان مسجلاً |
| `(app)` | `requireUser()` في Layout — RSC |
| `(admin)` | `requireRole(['ADMIN','SUPER_ADMIN'])` |
| `api/admin/*` | حارس إضافي على مستوى الـ Handler (لا نعتمد على الـ Layout) |

`middleware.ts` يتحقق من وجود الكوكي فقط (سريع) — **التحقق الحقيقي من الصلاحية يتم في الخادم**
لأن الـ middleware يعمل على Edge بلا وصول لقاعدة البيانات.

---

## 10. الأداء

| التقنية | التطبيق |
|---|---|
| RSC افتراضياً | `'use client'` فقط عند الحاجة الفعلية (تفاعل/حالة) |
| Static + ISR | Landing / Pricing / FAQ — `revalidate: 3600` |
| Caching | كتالوج الجهات والأسئلة عبر `unstable_cache` بوسم `catalog` يُبطَل عند تعديل Admin |
| Code Splitting | المحرر (TipTap) و Recharts عبر `dynamic()` |
| Pagination | كل القوائم — Cursor-based للمعاريض |
| Indexes | انظر `DATABASE.md §5` |
| Streaming | `loading.tsx` + Suspense لكل صفحة |
| Images | `next/image` + AVIF/WebP |

---

## 11. معالجة الأخطاء

نوع نتيجة موحّد عبر كل الطبقات:

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

class AppError {
  code: ErrorCode;      // UNAUTHORIZED | FORBIDDEN | NOT_FOUND | VALIDATION |
                        // RATE_LIMITED | INSUFFICIENT_CREDITS | AI_FAILED | INTERNAL
  message: string;      // 🇸🇦 رسالة عربية آمنة للعرض
  details?: unknown;    // لا تُرسل للعميل في الإنتاج
}
```

- الخدمات تُرجع `Result` ولا ترمي استثناءات للمنطق المتوقع.
- `lib/api/handler.ts` يلتقط أي استثناء غير متوقع → يسجّله → يُرجع `INTERNAL` برسالة عامة.
- **لا Stack Trace للمستخدم أبداً.**
- كل شاشة تملك أربع حالات: `Loading · Empty · Error(+Retry) · Success`.

---

## 12. قرارات معمارية موجزة

| القرار | البديل المرفوض | السبب |
|---|---|---|
| Next.js App Router (Full-stack) | Frontend + API منفصلان | فريق واحد، نشر واحد، SEO أفضل، سرعة تسليم |
| Server Actions + Route Handlers معاً | Actions فقط | الـ API يلزم للتصدير والتكاملات المستقبلية والاختبار |
| خدمات نقية | منطق داخل المكوّنات | قابلية اختبار + إمكانية استخراج الخدمة لاحقاً |
| Repository Pattern | Prisma في كل مكان | فرض عزل المستأجرين في نقطة واحدة |
| Discriminator Multi-tenant | قاعدة لكل مستأجر | تكلفة تشغيل أقل، ترقية أسهل، كافٍ لمرحلة SaaS المبكرة |
| محرك قوالب خاص | Handlebars | لا تنفيذ كود، سطح هجوم أصغر، أخطاء أوضح للـ Admin |

انظر `DECISIONS.md` للسجل الكامل.
