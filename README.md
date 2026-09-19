# معروضي

منصة عربية لإنشاء المعاريض والخطابات الرسمية عبر **مقابلة ذكية** ثم صياغة
بالذكاء الاصطناعي — مع ضمان صريح بألّا يُخترع أي معلومة لم يقدّمها المستخدم.

---

## التشغيل السريع

```bash
npm install
cp .env.example .env    # ثم ولّد SESSION_SECRET (انظر أدناه)
npm run db:start        # PostgreSQL 17 محلية (بلا Docker وبلا صلاحيات مدير)
npm run db:migrate
npm run db:seed
npm run dev
```

ثم افتح <http://localhost:3000>.

**حسابات تجريبية** (بيئة التطوير فقط):

| الدور | البريد | كلمة المرور |
|---|---|---|
| مدير | `admin@maroudak.sa` | `Admin@12345` |
| مستخدم | `demo@maroudak.sa` | `Demo@12345` |

### تفعيل الذكاء الاصطناعي

المنصة تعمل بالكامل بدونه (عدا التوليد). لتفعيله أضف في `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

بدون المفتاح تُرجع نقطة التوليد `AI_NOT_CONFIGURED` برسالة عربية واضحة بدل أن تفشل.

---

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` · `npm start` | بناء وتشغيل الإنتاج |
| `npm run verify` | typecheck + lint + tests + build — **بوابة كل مرحلة** |
| `npm run check:env` | يتحقق من حراس إعدادات الإنتاج |
| `npm run db:start` · `db:stop` · `db:status` | قاعدة البيانات المحلية |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | الترحيلات والبذور |
| `npm test` · `test:unit` · `test:integration` | الاختبارات (Vitest) |
| `npm run test:e2e` | اختبارات المتصفح (Playwright على Edge المثبّت) — تتطلب القاعدة والبذور |

توليد سرّ الجلسة:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## النشر

الإنتاج على **خادم واحد في Oracle Cloud — جدة** (بقاء البيانات داخل السعودية،
#D-033) بالنطاق `maroody.com`: Nginx + Node (systemd) + PostgreSQL على الجهاز
نفسه، ونسخ احتياطي يومي.

| الوثيقة | المحتوى |
|---|---|
| [deploy/README.md](deploy/README.md) | **الدليل المعتمد**: الخادم · DNS · HTTPS · أول نشر · النسخ الاحتياطي · Google |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | كل متغيّر بيئة ودوره ومتى يلزم |
| [PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) | قائمة ما قبل الإطلاق |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | البديل المُدار (Vercel + Neon) — غير معتمد حالياً |

**لا نطاق ولا سرّ داخل الشيفرة** — كله من متغيرات البيئة (`.env.example`).

---

## البنية

```
docs/     PROJECT_PLAN · ARCHITECTURE · DATABASE · API · AI_SYSTEM · SECURITY
          TESTING · DECISIONS · DEPLOYMENT · ENVIRONMENT · PRODUCTION_CHECKLIST
prisma/   المخطط + البذور (28 جهة · 5 فئات · 21 نوع طلب · 98 سؤال · 15 قاعدة شرطية · 43 موجّهاً)
src/
  app/          الصفحات ومسارات الـ API
  components/   مكوّنات العرض
  features/     وحدات المنتج (auth · interview · letters · admin · marketing)
  services/     ❤️ منطق الأعمال النقي — لا يعرف Next.js ولا Prisma
  lib/          البنية التحتية (db · auth · security · api)
tests/    unit · integration (على PostgreSQL حقيقية) · e2e (Playwright)
```

**المبدأ الحاكم:** كل ما هو جوهري — محرك الأسئلة، الشروط، القوالب، بناء
الـ Prompt، الضوابط — دوال نقية في `src/services/` قابلة للاختبار بالكامل
ومستقلة عن الإطار. التفاصيل في [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## ما يميّز هذا المنتج تقنياً

| | |
|---|---|
| **محرك أسئلة ديناميكي** | الأسئلة بيانات لا كود. إضافة جهة أو سؤال أو قاعدة شرطية من لوحة التحكم تسري **فوراً بلا نشر**. |
| **منطق شرطي بـ DAG** | 14 عاملاً، تسلسل غير محدود، انتشار الإخفاء نحو الأسفل، وكشف الدورات يرفض القاعدة عند الحفظ. |
| **ضوابط ضد الهلوسة** | كل رقم في المخرَج يُطابَق بإجابات المستخدم (مع تطبيع الأرقام العربية-الهندية)، والاستشهاد النظامي محظور، والنقص يُترك كعلامة `[أدخل …]` بارزة. |
| **فحص جودة من ثمانية محاور** | مخرَج مهيكل بـ Zod. يُبلغ ولا يُعدّل — القرار للمستخدم. |
| **محاسبة صادقة** | لا يُخصم رصيد إلا بعد نجاح فعلي. نجاح النموذج مع فشل الحفظ يُسجَّل `ORPHANED` بدل أن يُبتلع. |
| **عربية صحيحة في المخرجات** | PDF عبر محرك تشكيل المتصفح (حروف متصلة وقابلة للتحديد)، وDOCX بـ `bidirectional` + `rightToLeft`. |

---

## الأمان

كلمات المرور والجلسات مُجزّأة، والجلسات قابلة للإبطال الفوري، وكل استعلام
مقيّد بالمالك **داخل شرط الاستعلام** لا بعده. التفاصيل ونموذج التهديد في
[docs/SECURITY.md](docs/SECURITY.md).

⚠️ قبل الإطلاق راجع [قائمة التحقق](docs/SECURITY.md#12-قائمة-التحقق-قبل-الإطلاق).

---

## الحالة

الاختبارات: **144** وحدة وتكامل (على PostgreSQL حقيقية) + **28** اختبار متصفح (سطح المكتب والجوال).
حالة المراحل الـ13 وما تبقّى: [docs/PROJECT_PLAN.md §4](docs/PROJECT_PLAN.md).

**قبل الإطلاق التجاري** راجع
[PRODUCTION_CHECKLIST.md §17](docs/PRODUCTION_CHECKLIST.md) — فيه ما لم
يُنفَّذ عمداً في v1 (بوابة الدفع · تحديد المعدّل عبر Redis).

**التسعير:** ٣٠ ريالاً للمعروض الواحد شاملة الضريبة، بلا اشتراكات ([#D-042](docs/DECISIONS.md)).

**إخلاء مسؤولية:** المنصة تساعد في صياغة الخطابات ولا تقدّم استشارة قانونية.
