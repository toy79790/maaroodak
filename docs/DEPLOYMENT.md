# DEPLOYMENT — نشر «معروضك» على الإنترنت

دليل عملي من مشروع محلي إلى `https://www.example.com` يعمل بالكامل.

> استبدل `example.com` بنطاقك في كل مكان. **لا يوجد نطاق مكتوب داخل الشيفرة** —
> كله يأتي من `NEXT_PUBLIC_APP_URL`.

---

## 1. معمارية الإنتاج

```
                    المستخدم
                       │
                       ▼
        ┌──────────────────────────────┐
        │  DNS  ·  example.com         │
        │  A / CNAME → منصة الاستضافة   │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  HTTPS / TLS  (شهادة تلقائية) │
        │  HSTS · إعادة توجيه 80 → 443  │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  منصة الاستضافة (Vercel …)     │
        │  توحيد النطاق (www ↔ apex)    │
        │  CDN للأصول الثابتة            │
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │  تطبيق Next.js                │
        │  ├─ صفحات RSC                 │
        │  ├─ middleware (فحص كوكي)     │
        │  └─ مسارات API (نفس الأصل)    │
        └───┬──────────┬───────────┬───┘
            │          │           │
            ▼          ▼           ▼
    ┌───────────┐ ┌─────────┐ ┌──────────────┐
    │PostgreSQL │ │ تخزين   │ │ Anthropic API│
    │  (مُدارة) │ │S3-متوافق│ │ (خادم فقط)   │
    └───────────┘ └─────────┘ └──────────────┘
```

**ملاحظة معمارية:** لا يوجد Backend منفصل. Next.js يقدّم الواجهة ومسارات
الـ API من **نفس الأصل**، ولهذا لا حاجة إلى CORS مفتوح
(`lib/security/cors.ts` يقيّده على الأصول المصرّح بها فقط).

**مفتاح الذكاء الاصطناعي لا يلمس المتصفح أبداً:**

```
المتصفح ──▶ /api/letters/generate ──▶ Anthropic ──▶ الرد ──▶ المتصفح
            (الخادم · المفتاح هنا)
```

---

## 2. المتطلبات قبل البدء

| # | المتطلب | ملاحظات |
|---|---|---|
| 1 | حساب GitHub | المستودع مصدر النشر |
| 2 | حساب على منصة استضافة | Vercel · Netlify · Railway · Render |
| 3 | PostgreSQL 15+ مُدارة | Neon · Supabase · Railway · RDS |
| 4 | نطاق مسجّل | من أي مسجّل نطاقات |
| 5 | مفتاح Anthropic | من console.anthropic.com |
| 6 | حاوية S3-متوافقة | **اختياري** — للمرفقات لاحقاً |

---

## 3. رفع المشروع إلى GitHub

```bash
git init
git add .
git commit -m "معروضك — النسخة الأولى"
git branch -M main
git remote add origin https://github.com/<اسمك>/maroudak.git
git push -u origin main
```

**قبل الدفع تأكّد:**

```bash
git status --short | grep -E '^\?\?.*\.env$'   # يجب ألّا يُخرج شيئاً
```

`.gitignore` يستثني `.env` و`.pgdata` و`.storage` — لكن تحقّق بنفسك.
مفتاح مُودَع في Git يبقى في التاريخ حتى بعد حذفه.

---

## 4. إنشاء قاعدة البيانات

أنشئ قاعدتين منفصلتين — **staging لا تشارك بيانات الإنتاج إطلاقاً**:

| البيئة | الاسم المقترح |
|---|---|
| Production | `maroudak_prod` |
| Staging | `maroudak_staging` |

انسخ **رابطين** لا رابطاً واحداً. يجب أن يحوي كلاهما `sslmode=require`:

| المتغيّر | الرابط | يُستخدم في |
|---|---|---|
| `DATABASE_URL` | المُجمَّع — يحوي `-pooler` | وقت التشغيل |
| `DIRECT_DATABASE_URL` | المباشر — بلا `-pooler` | الترحيلات أثناء البناء |

```
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/maroudak_prod?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/maroudak_prod?sslmode=require
```

> **لماذا اثنان؟** دوال Vercel تفتح اتصالاً لكل استدعاء فتحتاج المُجمَّع،
> لكن مُجمِّع Neon لا يدعم أقفال Prisma Migrate الاستشارية فيفشل
> `migrate deploy` أثناء البناء. التفصيل في [DECISIONS.md #D-032](DECISIONS.md).

> إن لم يضف المزوّد `sslmode` تلقائياً فأضفه يدوياً. اتصال قاعدة بيانات
> بلا TLS يعني مرور بيانات المستخدمين مكشوفة على الشبكة.

---

## 5. ربط المستودع بمنصة الاستضافة

على Vercel (المسار الأقصر لـ Next.js):

1. **Add New → Project**
2. اختر مستودع `maroudak`
3. الإطار يُكتشف تلقائياً (Next.js) — لا تغيّر أوامر البناء
4. **لا تنشر بعد** — أضف المتغيرات أولاً، وإلا فشل البناء عند التحقق منها

---

## 6. متغيرات البيئة

المرجع الكامل: [ENVIRONMENT.md](ENVIRONMENT.md).

### الحد الأدنى للإنتاج

```env
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://www.example.com
CANONICAL_HOST_MODE=www
DATABASE_URL=postgresql://…-pooler…?sslmode=require
DIRECT_DATABASE_URL=postgresql://…?sslmode=require
SESSION_SECRET=<48 بايت عشوائية>
ANTHROPIC_API_KEY=sk-ant-…
LOG_LEVEL=info
```

### توليد السرّ

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

سرّ **مختلف لكل بيئة**. تسريب سرّ staging يجب ألّا يمنح جلسات إنتاج.

### التخزين (عند تفعيل المرفقات)

```env
STORAGE_DRIVER=s3
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
STORAGE_BUCKET=maroudak-uploads
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=…
STORAGE_SECRET_ACCESS_KEY=…
```

### ⚠️ نقطتان تُوقعان كثيرين

1. **`NEXT_PUBLIC_APP_URL` يُدمج وقت البناء.** تغييره يتطلب **إعادة بناء**،
   لا إعادة تشغيل. على Vercel: Deployments → Redeploy.

2. **اضبط النطاق لكل بيئة على حدة.** معاينات الفروع تحتاج
   `NEXT_PUBLIC_APP_URL` الخاص بها، وإلا أشارت روابطها المعيارية إلى الإنتاج.

---

## 7. الترحيل والبذور

### الترحيل

```bash
DATABASE_URL="<رابط الإنتاج>" npx prisma migrate deploy
```

`migrate deploy` يطبّق الترحيلات المُودَعة فقط ولا يُنشئ ولا يحذف شيئاً
من تلقائه — وهو الأمر **الوحيد** المسموح في الإنتاج.

> ❌ **لا تستخدم `prisma db push` في الإنتاج.** يوفّق المخطط بالقوة وقد
> يحذف أعمدة فيها بيانات بلا سجل ولا تراجع. التفاصيل في
> [DATABASE.md §9](DATABASE.md).

**تشغيله تلقائياً عند كل نشر:** أضف في `package.json`:

```json
"vercel-build": "prisma generate && prisma migrate deploy && next build"
```

### البذور

مرة واحدة بعد أول ترحيل:

```bash
DATABASE_URL="<رابط الإنتاج>" npm run db:seed
```

البذور **متكرّرة الأمان**: تشغيلها مجدداً يُحدّث الكتالوج بلا مساس بمعاريض
المستخدمين — وهذه هي طريقة إضافة جهات جديدة لاحقاً.

`NODE_ENV=production` يجعل البذور **تتخطى الحسابات التجريبية** تلقائياً.
أنشئ حساب المسؤول بالتسجيل العادي ثم ارفع دوره:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
```

---

## 8. ربط النطاق

### على المنصة

أضف نطاقين: `example.com` و`www.example.com`.

### سجلات DNS

| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | عنوان المنصة |
| CNAME | `www` | نطاق المنصة |

الانتشار يستغرق من دقائق إلى 48 ساعة.

### توحيد النطاق

النطاقان يجب أن يصلا لوجهة واحدة، وإلا انقسمت أرشفة محركات البحث وانكسرت
الجلسات (كوكي `www.example.com` لا يصل `example.com`).

```env
CANONICAL_HOST_MODE=www      # example.com → www.example.com
NEXT_PUBLIC_APP_URL=https://www.example.com
```

أو العكس:

```env
CANONICAL_HOST_MODE=apex     # www.example.com → example.com
NEXT_PUBLIC_APP_URL=https://example.com
```

`next.config.ts` يشتقّ التحويل من هاتين القيمتين — تحويل دائم (308) يحفظ
الطريقة والجسم وتفهمه محركات البحث كنقل نهائي.

> إن كانت منصتك تتولّى التوحيد بنفسها، اضبط `CANONICAL_HOST_MODE=none`
> لتفادي تحويل مزدوج.

---

## 9. HTTPS

المنصات الحديثة تُصدر شهادة Let's Encrypt وتُجددها تلقائياً.

**ما يفرضه التطبيق:**

| الطبقة | الآلية |
|---|---|
| رفض HTTP | `env.ts` يرفض الإقلاع إن كان `NEXT_PUBLIC_APP_URL` بلا HTTPS |
| HSTS | `max-age=63072000; includeSubDomains; preload` |
| ترقية المحتوى | `upgrade-insecure-requests` في CSP |
| كوكيز آمنة | `secure` + `httpOnly` + `sameSite=lax` |

**تحقّق:**

```bash
curl -sI https://www.example.com | grep -i strict-transport
curl -sI http://www.example.com | grep -i location   # يجب أن يحوّل إلى https
```

---

## 10. اختبار الإنتاج

### الفحص الصحي

```bash
curl -s https://www.example.com/api/health | jq
```

```json
{
  "status": "ok",
  "environment": "production",
  "checks": {
    "database": { "status": "ok", "latencyMs": 12 },
    "ai": { "status": "ok" },
    "storage": { "status": "ok" }
  }
}
```

`503` يعني قاعدة البيانات معطّلة. `ai: not_configured` يعني أن المفتاح مفقود —
المنصة تعمل لكن بلا توليد.

> النقطة عامة بلا مصادقة (تحتاجها أدوات المراقبة قبل وجود جلسة)، ولهذا
> **لا تكشف أي سرّ**: لا روابط اتصال ولا مفاتيح ولا رسائل أخطاء داخلية.

### الاختبار اليدوي

اتبع [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).

### التحقق الأمني السريع

```bash
# ترويسات الأمان
curl -sI https://www.example.com | grep -Ei 'content-security|x-frame|strict-transport'

# لوحة الإدارة محمية
curl -s -o /dev/null -w '%{http_code}' https://www.example.com/admin   # 307 → /login

# لا فهرسة لمساحات المستخدم
curl -s https://www.example.com/robots.txt
```

---

## 11. المراقبة

### الحد الأدنى

اربط مراقب توفّر (UptimeRobot · BetterStack) على `/api/health` كل 5 دقائق،
واضبط التنبيه على أي رد غير 200.

### السجلات

`lib/logging/logger.ts` يُخرج JSON مهيكلاً في البيئات المنشورة، فيلتقطه أي
مُجمِّع بلا تحليل نصّي:

```json
{"level":"error","time":"…","env":"production","message":"فشل نداء ذكاء اصطناعي","scope":"ai","kind":"timeout"}
```

**استعلامات مفيدة:** `scope:ai AND level:error` (فشل التوليد) ·
`scope:security` (تجاوز الحدود) · `scope:auth AND level:warn` (محاولات دخول فاشلة).

**ما لا يُسجَّل إطلاقاً:** كلمات المرور، الرموز، المفاتيح، أرقام الهوية،
محتوى المعاريض، وإجابات المستخدمين — يُحجب بالاسم لا بانتباه الكاتب.

### التكلفة

لوحة `/admin/analytics` تعرض التكلفة لكل معروض ومعدّل الفشل ومتوسط الاستجابة.
راجعها أسبوعياً: ارتفاع التكلفة لكل معروض يعني موجّهاً تضخّم أو نموذجاً تغيّر.

---

## 12. النسخ الاحتياطي

### قاعدة البيانات

فعّل النسخ التلقائي من مزوّد قاعدة البيانات (أغلبهم يوفّره افتراضياً).
**واختبر الاسترجاع مرة واحدة على الأقل** — نسخة لم تُختبر ليست نسخة.

نسخة يدوية:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=maroudak-$(date +%F).dump
pg_restore --dbname="$RESTORE_URL" --clean --if-exists maroudak-2026-08-25.dump
```

### ما يجب أن تغطيه النسخة

| البيانات | الجداول |
|---|---|
| المستخدمون | `User` · `Session` · `OrganizationMember` |
| المعاريض | `Letter` · `LetterVersion` · `Feedback` |
| الكتالوج | `Department` · `RequestType` · `Question` · `QuestionOption` · `QuestionCondition` |
| القوالب والموجّهات | `Template` · `Prompt` |
| الإعدادات | `SystemSetting` · `Plan` |
| المحاسبة | `CreditTransaction` · `AIUsage` |

`pg_dump` يغطيها كلها. الملفات المرفوعة (عند تفعيلها) تُنسخ من حاوية التخزين
بشكل منفصل.

---

## 13. Staging

بيئة مطابقة للإنتاج ببيانات منفصلة — **لا تختبر على بيانات المستخدمين**.

| المتغيّر | القيمة |
|---|---|
| `APP_ENV` | `staging` |
| `NEXT_PUBLIC_APP_URL` | `https://staging.example.com` |
| `DATABASE_URL` | قاعدة staging المنفصلة |
| `SESSION_SECRET` | سرّ مختلف تماماً |
| `LOG_LEVEL` | `debug` |

على Vercel: اربط فرع `develop` ببيئة Preview وأعطها متغيراتها الخاصة.

**احجب staging عن الفهرسة** بإضافة رأس `X-Robots-Tag: noindex` من إعدادات المنصة.

---

## 14. التخزين

**لا يُكتب أي ملف في نظام ملفات الخادم في الإنتاج.** الحاويات لها نظام ملفات
مؤقت وغير مشترك: الملف يختفي عند إعادة النشر ولا تراه النسخ الأخرى.
`getStorage()` يرفض التخزين المحلي في البيئات المنشورة **عند الإقلاع** — الفشل
المبكر أرحم من فقدان ملفات بصمت.

### الحالة اليوم

v1 **لا ترفع أي ملف**. المعاريض تُصدَّر بالبثّ المباشر (PDF عبر طباعة
المتصفح، DOCX يُبنى في الذاكرة ويُرسل) ولا تُكتب على القرص إطلاقاً.

طبقة التخزين جاهزة لتفعيل المرفقات: واجهة `StoragePort` + موقّع SigV4 يعمل
مع AWS S3 و Cloudflare R2 و DigitalOcean Spaces و MinIO.

### ضوابط الرفع (مطبّقة في `services/storage/ports.ts`)

- الحد 5 ميجابايت
- الأنواع: PDF · JPEG · PNG · WebP
- التحقق **بالرقم السحري** لا بالامتداد ولا بـ `Content-Type` — كلاهما
  يتحكم فيه العميل
- المفتاح عشوائي ولا يُشتق من اسم الملف الأصلي: اسم مثل
  «تقرير-طبي-محمد.pdf» يسرّب معلومة شخصية في الرابط نفسه
- الملفات خاصة افتراضياً؛ الوصول برابط موقّت قصير الأجل

---

## 15. لوحة الإدارة

على `/admin` من نفس النطاق — **لا نطاق فرعي منفصل في v1**.

نطاق منفصل يعني كوكيز عبر المواقع وإعداد CORS، وهو تعقيد بلا مقابل أمني:
الحماية الفعلية في التخويل لا في اسم النطاق.

| الطبقة | الآلية |
|---|---|
| المصادقة | كوكي جلسة httpOnly + سجل جلسات في القاعدة |
| التخويل | `requireAdmin()` في التخطيط + `assertPermission()` في **كل** مسار API |
| التدقيق | كل عملية إدارية في `AuditLog` بفاعلها ووقتها |
| العزل | محتوى المعاريض لا يُقرأ إلا بصلاحية `letter:readContent` |

> الحارس في مسار الـ API نفسه لا في التخطيط وحده: التخطيطات لا تعمل على
> مسارات الـ API، والاعتماد عليها ثغرة كلاسيكية.

---

## 16. تدفّق النشر

```
git push origin main
        │
        ▼
  GitHub Actions
  typecheck · lint · test · build · audit
        │
   ┌────┴────┐
   ▼         ▼
 فشل      نجاح
   │         │
   │         ▼
   │   بناء على المنصة
   │   prisma migrate deploy
   │   next build
   │         │
   │         ▼
   │   نشر تدريجي
   │         │
   │         ▼
   │   /api/health
   │
   ▼
لا نشر
```

المنصة تحتفظ بالنشر السابق: **التراجع فوري** من واجهتها إن ظهر خلل.

---

## 17. حل المشاكل الشائعة

| العرَض | السبب الأرجح | الحل |
|---|---|---|
| فشل البناء عند «متغيرات البيئة غير صالحة» | متغيّر مطلوب مفقود | راجع رسالة الخطأ — تسمّي المتغيّر بدقة |
| «SESSION_SECRET ما زال على القيمة الافتراضية» | لم تُولّد سرّاً | ولّده وأعد النشر |
| الروابط المعيارية تشير لـ localhost | `NEXT_PUBLIC_APP_URL` لم يُضبط وقت البناء | اضبطه ثم **أعد البناء** لا التشغيل |
| `503` من `/api/health` | قاعدة البيانات غير متاحة | تحقق من `DATABASE_URL` و`sslmode` وقواعد الجدار الناري |
| `AI_NOT_CONFIGURED` | `ANTHROPIC_API_KEY` مفقود | أضفه وأعد النشر |
| «التخزين المحلي غير مسموح» | `STORAGE_DRIVER=local` في بيئة منشورة | اضبطه على `s3` أو أزل تفعيل الرفع |
| تسجيل الخروج التلقائي | تغيّر `SESSION_SECRET` | متوقّع — كل الجلسات تُبطل |
| حلقة تحويل لا نهائية | تعارض توحيد النطاق بين المنصة والتطبيق | اضبط `CANONICAL_HOST_MODE=none` ودع المنصة تتولّاه |

---

## 18. الوثائق ذات الصلة

| الملف | المحتوى |
|---|---|
| [ENVIRONMENT.md](ENVIRONMENT.md) | كل متغيّر بيئة ودوره ومتى يلزم |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | قائمة ما قبل الإطلاق |
| [DATABASE.md](DATABASE.md) | المخطط والفهارس وسياسة الترحيل |
| [SECURITY.md](SECURITY.md) | نموذج التهديد والضوابط |
| [ARCHITECTURE.md](ARCHITECTURE.md) | الطبقات وحدود الوحدات |
