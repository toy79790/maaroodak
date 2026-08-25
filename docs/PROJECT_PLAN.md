# PROJECT_PLAN — منصة «معروضك»

> منصة SaaS عربية لإنشاء المعاريض والخطابات الرسمية عبر مقابلة ذكية + توليد بالذكاء الاصطناعي.

---

## 1. تحليل المنتج

### 1.1 المشكلة

المواطن/المقيم يحتاج مخاطبة جهة رسمية (وزارة، إمارة، بنك، جامعة…) بخطاب رسمي مقنع.
العقبات الحقيقية:

| العقبة | الأثر |
|---|---|
| لا يعرف الصيغة الرسمية المناسبة للجهة | خطاب ضعيف أو غير مناسب |
| لا يعرف ما هي المعلومات التي يجب أن يذكرها | نقص جوهري يُضعف الطلب |
| صعوبة الصياغة العربية الرسمية | ركاكة / مبالغة / أخطاء إملائية |
| لا يملك قالباً جاهزاً | يبدأ من صفحة بيضاء |
| يلجأ لكُتّاب المعاريض | تكلفة مرتفعة + وقت |

**الرؤية الأساسية:** المشكلة ليست «الكتابة»، المشكلة هي **استخراج المعلومات الصحيحة**.
لذلك جوهر المنتج ليس مولّد نصوص — بل **محرك مقابلة (Interview Engine)** يعرف ما يجب أن يسأل عنه لكل (جهة × نوع طلب)، ثم يُسلّم معلومات نظيفة ومنظمة إلى مولّد الصياغة.

### 1.2 المستخدمون (Personas)

1. **المستفيد الفردي** — الفئة الأكبر. أمّي تقنياً نسبياً، غالباً على الجوال. يحتاج بساطة قصوى.
2. **صاحب منشأة / مؤسسة** — خطابات تجارية، اعتراضات، تظلمات.
3. **مكتب خدمات / معقّب** — حجم استخدام عالٍ → أهم شريحة دافعة (خطة Business).
4. **Admin المنصة** — يدير الجهات والأسئلة والقوالب والـ Prompts.
5. **Organization Owner** (مستقبلاً) — Multi-tenant: جهاته وقوالبه الخاصة.

### 1.3 القيمة المميِّزة (Differentiation)

- ليست ChatGPT: النظام **يعرف مسبقاً** ما تحتاجه كل جهة (Question Bank محكوم من Admin).
- **لا يخترع معلومات** — Guardrail صارم + Quality Check قبل العرض.
- مخرجات جاهزة للطباعة: A4 / RTL / PDF / DOCX بخط عربي صحيح.
- قابل للتوسع: إضافة جهة جديدة = بيانات، لا كود.

### 1.4 مقاييس النجاح (North Star)

**North Star Metric:** عدد المعاريض المكتملة والمُنزَّلة (Completed & Exported Letters) شهرياً.

مقاييس مساندة:
- Interview Completion Rate ≥ 70٪
- Drop-off per question (كشف الأسئلة القاتلة)
- Regeneration Rate (كل إعادة توليد = إشارة ضعف في الـ Prompt)
- 👍 Rate ≥ 80٪
- تكلفة AI لكل معروض (Unit Economics)

---

## 2. النطاق (Scope)

### داخل النطاق — v1

- Landing Page تسويقية + SEO
- تسجيل / دخول / استعادة كلمة مرور / ملف شخصي
- Dashboard مستخدم + «معاريضي» + بحث وفلاتر + مفضلة
- محرك أسئلة ديناميكي + Conditional Logic
- AI Follow-up Questions (اكتشاف النقص)
- محرك قوالب بمتغيرات `{{var}}`
- توليد المعروض + Quality Check
- محرر نصوص + 10 أدوات AI
- Preview ورقي A4 + PDF + DOCX
- Version History + Feedback
- Admin Dashboard كامل (جهات، أنواع، أسئلة، Question Builder، قوالب، Prompts، مستخدمون، إحصائيات، إعدادات)
- Credits + Plans (بنية الاشتراكات جاهزة، بدون بوابة دفع)
- AI Usage Tracking + Audit Log
- Multi-tenant Ready (Organization) — مفعّل على مستوى المخطط والاستعلامات

### خارج النطاق — v1 (مصمَّم لكنه غير مُنفَّذ)

- بوابة دفع فعلية (Stripe/Moyasar) — الـ Architecture تسمح بإضافتها كـ `PaymentProvider`
- تطبيق جوال أصلي
- إرسال المعروض للجهة إلكترونياً
- OCR للمستندات المرفوعة
- تعدد اللغات (i18n جاهزة بنيوياً، عربي فقط v1)

### غير مسموح صراحةً

- أي استشارة قانونية أو ادعاء بأنها كذلك (AI Disclaimer إلزامي)
- اختراع أسماء/أرقام/مبالغ/تواريخ/أنظمة قانونية

---

## 3. الرحلة الأساسية (Golden Path)

```
Landing → ابدأ الآن → تسجيل/دخول
   → اختيار الجهة        (Step 1)
   → اختيار نوع الطلب     (Step 2)
   → المقابلة الذكية      (Step 3..N)  ← Question Engine + Conditional Logic
   → أسئلة AI الإضافية    (اختياري)
   → مراجعة المعلومات     (Review)
   → توليد AI            (Generation + Quality Check)
   → Preview ورقي        (A4/RTL)
   → تعديل (Editor + AI Tools)
   → حفظ (Version)
   → PDF / DOCX
   → Feedback 👍👎
```

**قواعد UX حاكمة للرحلة:**
- سؤال واحد (أو سؤالان مترابطان) في كل شاشة — لا نماذج ضخمة.
- Progress: «السؤال 3 من 9» + شريط تقدّم.
- حفظ تلقائي للمسودة بعد كل إجابة (لا يفقد المستخدم شيئاً).
- زر رجوع دائم لا يفقد الإجابات.
- على الجوال: زر «التالي» ثابت أسفل الشاشة.

---

## 4. المراحل (Phases)

كل مرحلة لها **Definition of Done** واحد ثابت:
`typecheck ✅ + lint ✅ + build ✅ + tests ✅ + مراجعة UX ✅`

| # | المرحلة | المخرجات | حالة |
|---|---|---|---|
| 1 | Architecture + Database + UI Foundation | Next.js + TS + Tailwind RTL + Prisma schema + Design System + Landing | ✅ |
| 2 | Authentication + Dashboard | Register/Login/Reset/Profile + Session + RBAC + Dashboard | ✅ |
| 3 | Departments + Request Types | كتالوج الجهات وأنواع الطلبات + Seed | ✅ |
| 4 | Question Engine | تعريف الأسئلة + الجلسة + التقدّم + الحفظ التلقائي | ✅ |
| 5 | Conditional Logic | محرك الشروط + تقييم DAG + اختبارات مكثفة | ✅ |
| 6 | Template Engine | القوالب + المتغيرات + الرندر الآمن | ✅ |
| 7 | AI Integration | AIService + Prompt Builder + Guardrails + Quality Check + Usage Tracking | ✅ |
| 8 | Letter Editor | TipTap RTL + 10 أدوات AI + Versions | ✅ |
| 9 | PDF + Word | A4 Print CSS + PDF + DOCX عربي RTL | ✅ |
| 10 | Admin Dashboard | كل شاشات الإدارة + Question Builder + Template Builder + Prompt Builder | ✅ |
| 11 | Subscriptions + Credits | Plans + Credits + Quota Enforcement | 🟡 |
| 12 | Security + Testing | Rate limit, CSRF, Headers, Audit + Unit/Integration | 🟡 |
| 13 | Performance + SEO + A11y | Caching, Indexes, Splitting, Metadata, Sitemap, ARIA | 🟡 |

**ما تبقّى (🟡):**

| المرحلة | المُنفَّذ | المتبقّي |
|---|---|---|
| 11 | Credits كاملة (دفتر أستاذ · خصم ذرّي · حدود) · Plans في القاعدة والعرض | فرض حصة شهرية لكل خطة · بوابة دفع (خارج نطاق v1 عمداً) |
| 12 | Rate limit · CSRF · CSP · RBAC · تعقيم HTML · تجزئة الجلسات · 91 اختباراً | اختبارات E2E بـ Playwright · اختبار عزل المستأجرين |
| 13 | RSC · Code splitting · فهارس · Sitemap · Robots · Structured Data · ARIA · تخطي للمحتوى | فهرس `pg_trgm` للبحث النصي · تدقيق Lighthouse |

### تفصيل المخرجات لكل مرحلة

**Phase 1 — الأساس**
- مشروع Next.js (App Router) + TypeScript strict
- Tailwind RTL + Design Tokens + مكوّنات أساسية (Button, Card, Input, Select, Badge, Dialog, Toast, EmptyState, Skeleton)
- Prisma schema كامل (كل الـ Models) + Migration أولى
- قاعدة بيانات PostgreSQL تعمل محلياً
- Landing Page بكل أقسامها
- `pnpm build` ناجح

**Phase 4 — Question Engine (القلب)**
- `QuestionEngine` نقي (pure) بلا اعتماد على DB أو React → قابل للاختبار 100٪
- `InterviewSession` مُخزّنة في DB (استئناف لاحق)
- Validation لكل نوع سؤال عبر Zod مُولَّد ديناميكياً

**Phase 7 — AI (القلب الثاني)**
- `AIService` مستقل تماماً عن Next.js
- `PromptBuilder` يبني System + User Prompt من (جهة + نوع + إجابات + قالب + قواعد)
- `GuardrailChecker` + `QualityChecker`
- `AIUsage` تسجيل كامل (tokens/cost/model/latency/status)

---

## 5. المخاطر وإدارتها

| الخطر | الاحتمال | الأثر | المعالجة |
|---|---|---|---|
| هلوسة AI (اختراع مبالغ/أنظمة) | عالٍ | **حرج** | System Prompt صارم + Placeholder Policy + QualityCheck يفحص كل رقم مقابل الإجابات |
| PDF عربي بحروف منفصلة/معكوسة | عالٍ | حرج | لا نستخدم مكتبات لا تدعم Arabic Shaping؛ نعتمد محرك تشكيل المتصفح (Print/Chromium) |
| تكلفة AI تفوق الإيراد | متوسط | عالٍ | Credits + Quota + AIUsage + نموذج أرخص للأدوات المساعدة |
| مسار المشروع يحتوي أحرفاً عربية (Windows) | متوسط | متوسط | تجنّب الأدوات الحساسة للمسار + توثيق البديل |
| تعقيد Conditional Logic | متوسط | عالٍ | محرك نقي + اختبارات وحدة شاملة + كشف الحلقات (cycles) |
| مسؤولية قانونية | منخفض | حرج | Disclaimer واضح + Terms + عدم تقديم استشارة قانونية |
| Multi-tenant leak | منخفض | حرج | كل استعلام يمرّ عبر Repository يفرض `organizationId` |

---

## 6. قرارات المنتج المُتخذة

1. **الجهة والقالب لا يُقيّدان النص** — القالب هيكل، والـ AI يملأ المحتوى ضمن الهيكل. هذا ما يجعل المخرجات ديناميكية لا نمطية.
2. **الأسئلة بيانات لا كود** — إضافة جهة/سؤال جديد لا تتطلب Deploy.
3. **AI لا يُسأل عن معلومة موجودة** — أسئلة المتابعة تُبنى فقط على الفجوات الفعلية.
4. **المستخدم يملك النص النهائي** — التوليد نقطة بداية، والمحرر هو الملكية.
5. **Placeholder بدل الاختراع** — عند نقص معلومة غير حرجة: `[أدخل رقم المعاملة]` بارز بصرياً.

---

## 7. حالة التنفيذ

يُحدَّث هذا الجدول بعد كل مرحلة. انظر أيضاً `DECISIONS.md` لسجل القرارات التقنية.
