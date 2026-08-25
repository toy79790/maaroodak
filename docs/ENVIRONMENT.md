# ENVIRONMENT — متغيرات البيئة

كل متغيّر يقرأه المشروع، ودوره، ومتى يلزم.
التحقق يجري في `src/config/env.ts` **عند الإقلاع** — متغيّر ناقص يمنع تشغيل
الخادم بدل أن يُظهر خللاً عند أول مستخدم.

---

## 1. قاعدة حاكمة: خادم مقابل عميل

| | `src/config/env.ts` | `src/config/public-env.ts` |
|---|---|---|
| يقرأ | كل المتغيرات | `NEXT_PUBLIC_*` فقط |
| يُستورد في | الخادم حصراً (`server-only`) | الخادم والعميل |
| يحوي أسراراً | نعم | **لا — أبداً** |

`NEXT_PUBLIC_*` تُدمج في حزمة المتصفح **وقت البناء**. أي قيمة فيها مقروءة
لأي زائر بفتح أدوات المطوّر. لهذا:

- ❌ لا مفتاح ولا كلمة مرور ولا رمز وصول في `NEXT_PUBLIC_*` مهما كان المبرر
- ⚠️ تغيير أي `NEXT_PUBLIC_*` يتطلب **إعادة بناء** لا إعادة تشغيل

فحص في CI يرفض أي `NEXT_PUBLIC_*` يحمل `KEY` أو `SECRET` أو `TOKEN` أو
`PASSWORD` في اسمه.

---

## 2. البيئة

### `APP_ENV` — مطلوب

`development` · `staging` · `production`

**لماذا لا نستخدم `NODE_ENV`؟** لأن Next.js يضبطه على `production` أثناء
البناء المحلي أيضاً، فلا يميّز بين staging والإنتاج — وهما بيئتان بقواعد
بيانات وأسرار مختلفة يجب ألّا تختلطا.

| القيمة | الأثر |
|---|---|
| `development` | كوكيز بلا `secure` · تفاصيل الأخطاء في الرد · تخزين محلي مسموح |
| `staging` | يُعامَل معاملة الإنتاج في الأمان · `LOG_LEVEL=debug` مفيد هنا |
| `production` | فحوص إقلاع صارمة (§8) · لا تفاصيل أخطاء · تخزين سحابي إلزامي |

### `NODE_ENV`

تضبطه أدوات البناء عادةً. اتركه `development` محلياً، و`test` في CI.

---

## 3. النطاق

### `NEXT_PUBLIC_APP_URL` — مطلوب

الأصل المعياري الكامل مع البروتوكول:

```env
NEXT_PUBLIC_APP_URL="https://www.example.com"
```

**مصدر الحقيقة الوحيد للنطاق.** يُستخدم في:

| الاستخدام | الملف |
|---|---|
| الروابط المعيارية و OpenGraph | `app/layout.tsx` · `config/site.ts` |
| خريطة الموقع و robots | `app/sitemap.ts` · `app/robots.ts` |
| فحص Origin (دفاع CSRF) | `lib/security/cors.ts` |
| توحيد النطاق | `next.config.ts` |
| روابط البريد | `features/auth/service.ts` |

**لا نطاق مكتوب داخل الشيفرة** — نفس البناء يصلح لأي نطاق.

### `APP_URL` — اختياري

تجاوز للخادم فقط، حين يختلف العنوان الداخلي عن العام (خلف وكيل عكسي).
اتركه فارغاً في الحالة المعتادة.

### `CANONICAL_HOST_MODE` — اختياري

`www` · `apex` · `none` (افتراضي)

| القيمة | السلوك |
|---|---|
| `www` | `example.com` → `www.example.com` (308) |
| `apex` | `www.example.com` → `example.com` (308) |
| `none` | بلا تحويل — للتطوير أو حين تتولّاه المنصة |

يجب أن يوافق `NEXT_PUBLIC_APP_URL`: إن كان `CANONICAL_HOST_MODE=www` فليكن
الرابط `https://www.example.com`، وإلا نشأت حلقة تحويل.

### `ALLOWED_ORIGINS` — اختياري

أصول إضافية مسموح بها في CORS، مفصولة بفواصل:

```env
ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
```

اتركه فارغاً عادةً — التطبيق أحادي الأصل ولا يحتاج CORS.
`Access-Control-Allow-Origin: *` غير مستخدم إطلاقاً.

---

## 4. قاعدة البيانات

### `DATABASE_URL` — مطلوب

```env
# محلياً
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/maroudak?schema=public"

# إنتاجياً
DATABASE_URL="postgresql://user:pass@host:5432/maroudak_prod?sslmode=require"
```

⚠️ `sslmode=require` إلزامي في الإنتاج. اتصال بلا TLS يعني مرور بيانات
المستخدمين مكشوفة.

فحص الإقلاع في الإنتاج يحذّر إن أشار الرابط إلى `localhost` — الحماية من
أشيع خطأ نشر: نسيان تبديل رابط قاعدة التطوير.

### `DATABASE_URL_TEST` — للتطوير و CI

قاعدة اختبارات التكامل. **تُعاد تهيئتها في كل تشغيل** — لا توجّهها أبداً إلى
قاعدة فيها بيانات تهمّك.

---

## 5. الجلسات

### `SESSION_SECRET` — مطلوب

32 حرفاً على الأقل. ولّد قيمة **مختلفة لكل بيئة**:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

يوقّع رمز الجلسة (JWT في كوكي httpOnly). تغييره يُبطل كل الجلسات فوراً —
وهذا مفيد كإجراء طوارئ عند الاشتباه في تسريب.

> **لمن يبحث عن `NEXTAUTH_SECRET` و`NEXTAUTH_URL`:** المشروع لا يستخدم
> NextAuth ([DECISIONS.md #D-005](DECISIONS.md)) — بُنيت المصادقة يدوياً
> لأننا نحتاج إبطالاً فورياً للجلسات، وهو ما لا يوفّره JWT عديم الحالة.
> المقابل: `SESSION_SECRET` ≡ `NEXTAUTH_SECRET` ·
> `NEXT_PUBLIC_APP_URL` ≡ `NEXTAUTH_URL`.

---

## 6. الذكاء الاصطناعي

### `ANTHROPIC_API_KEY` — اختياري تقنياً، لازم عملياً

```env
ANTHROPIC_API_KEY="sk-ant-…"
```

**خادم فقط.** لا يُقرأ في أي كود عميل، ولا يظهر في أي رد API، ولا يُسجَّل.

بدونه تعمل المنصة بالكامل عدا التوليد وأدوات التحرير، وتُرجع
`AI_NOT_CONFIGURED` برسالة عربية بدل أن تنهار — وهذا يجعل النشر ممكناً
قبل توفّر المفتاح.

المسار المفروض معمارياً:

```
المتصفح ──▶ Next.js API ──▶ Anthropic ──▶ الرد ──▶ المتصفح
```

النماذج والعمق وحدود الرموز تُضبط من **لوحة التحكم** لا من البيئة
(`/admin/settings`) — تغييرها لا يتطلب نشراً.

---

## 7. التخزين

### `STORAGE_DRIVER` — افتراضي `local`

| القيمة | متى |
|---|---|
| `local` | التطوير فقط — يُكتب في `.storage/` |
| `s3` | staging والإنتاج |

⚠️ `local` **مرفوض** في البيئات المنشورة: التطبيق يفشل عند الإقلاع.
الحاويات لها نظام ملفات مؤقت وغير مشترك — الملف يختفي عند إعادة النشر ولا
تراه النسخ الأخرى. الفشل المبكر أرحم من فقدان ملفات بصمت.

### متغيرات S3 — لازمة مع `STORAGE_DRIVER=s3`

```env
STORAGE_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
STORAGE_BUCKET="maroudak-uploads"
STORAGE_REGION="auto"
STORAGE_ACCESS_KEY_ID="…"
STORAGE_SECRET_ACCESS_KEY="…"
STORAGE_PUBLIC_URL=""
```

متوافق مع AWS S3 · Cloudflare R2 · DigitalOcean Spaces · MinIO.
يُستخدم نمط `path-style` لأنه الوحيد الذي يعمل على كل المزوّدين.

`STORAGE_PUBLIC_URL` اختياري: أصل عام (CDN) يحلّ محل نطاق الحاوية في
الروابط الموقّتة.

---

## 8. السجلات والمراقبة

### `LOG_LEVEL` — افتراضي `info`

`debug` · `info` · `warn` · `error`

| البيئة | المقترح |
|---|---|
| development | `debug` |
| staging | `debug` |
| production | `info` |
| CI | `error` |

في البيئات المنشورة يكون المخرَج JSON مهيكلاً؛ في التطوير نصّاً مقروءاً.

**التعقيم إلزامي:** كلمات المرور والرموز والمفاتيح وأرقام الهوية ومحتوى
المعاريض وإجابات المستخدمين تُحجب **بالاسم** — لا اعتماداً على انتباه كاتب
السطر.

### `SENTRY_DSN` — اختياري

رمز خدمة رصد الأخطاء. اتركه فارغاً إن لم تستخدمها.

---

## 9. البريد

```env
MAIL_FROM="no-reply@example.com"
SMTP_URL=""
```

بدون `SMTP_URL` تُطبع روابط استعادة كلمة المرور في **سجل الخادم** أثناء
التطوير. الإرسال الفعلي غير مُنفَّذ في v1.

---

## 10. فحوص الإقلاع في الإنتاج

عند `APP_ENV=production` يرفض التطبيق الإقلاع إن:

- [ ] `SESSION_SECRET` ما زال على القيمة التطويرية الافتراضية
- [ ] `NEXT_PUBLIC_APP_URL` بلا HTTPS
- [ ] `NEXT_PUBLIC_APP_URL` يشير إلى `localhost`
- [ ] `APP_URL` (إن وُجد) بلا HTTPS
- [ ] `STORAGE_DRIVER=s3` بلا حاوية أو بيانات اعتماد

**استثناء مقصود:** الفحوص تُتخطّى في طور البناء
(`NEXT_PHASE=phase-production-build`) لأن Next.js يضبط `NODE_ENV=production`
حتى في البناء المحلي — الفحص يخصّ التشغيل لا التجميع.

---

## 11. مصفوفة البيئات

| المتغيّر | development | staging | production |
|---|---|---|---|
| `APP_ENV` | `development` | `staging` | `production` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://staging.…` | `https://www.…` |
| `CANONICAL_HOST_MODE` | `none` | `none` | `www` أو `apex` |
| `DATABASE_URL` | محلية | قاعدة staging | قاعدة الإنتاج |
| `SESSION_SECRET` | أي قيمة | **سرّ منفصل** | **سرّ منفصل** |
| `ANTHROPIC_API_KEY` | اختياري | مفتاح اختبار | مفتاح الإنتاج |
| `STORAGE_DRIVER` | `local` | `s3` | `s3` |
| `LOG_LEVEL` | `debug` | `debug` | `info` |

**ثلاثة أسرار منفصلة تماماً.** تسريب سرّ staging يجب ألّا يمنح جلسة إنتاج
واحدة.

---

## 12. قائمة تحقق سريعة

قبل أول نشر:

- [ ] `.env` **غير** مُودَع في Git (`git ls-files .env` لا يُخرج شيئاً)
- [ ] `SESSION_SECRET` مُولَّد عشوائياً ومختلف لكل بيئة
- [ ] `NEXT_PUBLIC_APP_URL` يطابق النطاق الفعلي بـ HTTPS
- [ ] `DATABASE_URL` يشير لقاعدة الإنتاج مع `sslmode=require`
- [ ] `CANONICAL_HOST_MODE` يوافق `NEXT_PUBLIC_APP_URL`
- [ ] `ANTHROPIC_API_KEY` مضبوط (أو تقبل تعطيل التوليد مؤقتاً)
- [ ] `STORAGE_DRIVER=s3` مع بيانات اعتماد صالحة (إن فُعّل الرفع)
- [ ] `APP_ENV=production` — وليس `staging` سهواً
