# API — معروضك

**القاعدة:** `/api` · **الترميز:** JSON UTF-8 · **المصادقة:** كوكي جلسة `mrd_session` (httpOnly)

---

## 1. شكل الاستجابة الموحّد

```jsonc
// نجاح
{ "ok": true, "data": { … } }

// نجاح مع ترقيم
{ "ok": true, "data": [ … ], "meta": { "total": 143, "page": 2, "pageSize": 20, "hasMore": true } }

// فشل
{ "ok": false, "error": { "code": "VALIDATION", "message": "بيانات غير صحيحة", "fields": { "email": "بريد غير صالح" } } }
```

### رموز الأخطاء

| `code` | HTTP | المعنى |
|---|---|---|
| `VALIDATION` | 400 | مدخلات غير صالحة (`fields` تفصّل) |
| `UNAUTHORIZED` | 401 | لا جلسة أو منتهية |
| `FORBIDDEN` | 403 | لا صلاحية / CSRF |
| `NOT_FOUND` | 404 | غير موجود أو لا يخصّك (لا نفرّق — منعاً للتعداد) |
| `CONFLICT` | 409 | تعارض (بريد مستخدم، slug مكرر) |
| `RATE_LIMITED` | 429 | تجاوز الحد (+ `Retry-After`) |
| `INSUFFICIENT_CREDITS` | 402 | الرصيد لا يكفي |
| `QUOTA_EXCEEDED` | 402 | تجاوز حد الخطة الشهري |
| `AI_FAILED` | 502 | فشل مزوّد الذكاء الاصطناعي |
| `AI_BLOCKED` | 422 | رفض النموذج توليد المحتوى |
| `INTERNAL` | 500 | خطأ غير متوقع (بلا تفاصيل) |

**كل رسائل `message` بالعربية وصالحة للعرض المباشر.**

---

## 2. المصادقة — `/api/auth`

| Method | Path | Body | الرد |
|---|---|---|---|
| POST | `/register` | `{name, email, password, phone?}` | `{user}` + كوكي |
| POST | `/login` | `{email, password}` | `{user}` + كوكي |
| POST | `/logout` | — | `{ok:true}` |
| POST | `/forgot-password` | `{email}` | دائماً نجاح (لا كشف) |
| POST | `/reset-password` | `{token, password}` | `{ok:true}` — يُبطل كل الجلسات |
| GET | `/me` | — | `{user, credits, plan}` |
| PATCH | `/me` | `{name?, phone?, nationalId?, city?}` | `{user}` |
| POST | `/change-password` | `{current, next}` | يُبطل الجلسات الأخرى |
| DELETE | `/account` | `{password}` | حذف كامل |

---

## 3. الكتالوج — عام للمستخدم المسجّل

| Method | Path | الوصف |
|---|---|---|
| GET | `/departments?category=&q=&page=` | الجهات النشطة (مُخزَّنة مؤقتاً) |
| GET | `/departments/:slug` | جهة + أنواع طلباتها |
| GET | `/request-types?departmentId=` | أنواع الطلبات المتاحة للجهة |

---

## 4. المقابلة — `/api/interview`

| Method | Path | Body | الرد |
|---|---|---|---|
| POST | `/start` | `{departmentId, requestTypeId}` | `{sessionId, state}` |
| GET | `/:id` | — | `{session, state}` — للاستئناف |
| PATCH | `/:id/answer` | `{questionKey, value}` | `{state}` — يُعاد حساب المرئي والتقدّم |
| POST | `/:id/back` | — | `{state}` |
| POST | `/:id/follow-up` | — | `{questions[]}` — أسئلة AI (1 Credit) |
| POST | `/:id/abandon` | — | يُعلّم `ABANDONED` (للتحليلات) |

`state` هو `EngineState` (انظر `ARCHITECTURE.md §5`):
```jsonc
{
  "currentStep": { "index": 2, "questions": [ { "key":"debt_amount", "label":"…", "type":"NUMBER", … } ] },
  "totalSteps": 9, "progress": 0.33, "isComplete": false,
  "answeredCount": 2, "canGoBack": true
}
```

---

## 5. المعاريض — `/api/letters`

| Method | Path | Body / Query | ملاحظات |
|---|---|---|---|
| POST | `/generate` | `{sessionId}` | 1 Credit · بث · يُرجع `{letter, qualityReport, warnings}` |
| GET | `/` | `?q=&departmentId=&requestTypeId=&status=&favorite=&cursor=&limit=` | قائمة «معاريضي» |
| GET | `/:id` | — | معروض + آخر نسخة |
| PATCH | `/:id` | `{title?, contentHtml?}` | ينشئ `LetterVersion(USER_EDIT)` |
| DELETE | `/:id` | — | حذف ناعم |
| POST | `/:id/duplicate` | — | نسخة جديدة كمسودة |
| POST | `/:id/favorite` | `{value:boolean}` | |
| POST | `/:id/regenerate` | `{note?}` | 1 Credit |
| POST | `/:id/ai-tool` | `{tool, selection?}` | 1 Credit · `tool ∈ IMPROVE\|FORMALIZE\|SHORTEN\|EXPAND\|CLARIFY\|REWRITE\|TITLE\|INTRO\|CONCLUSION\|PROOFREAD` |
| GET | `/:id/versions` | — | سجل النسخ |
| POST | `/:id/versions/:v/restore` | — | ينشئ نسخة جديدة `RESTORED` (لا يحذف شيئاً) |
| GET | `/:id/export?format=pdf\|docx\|html` | — | ملف · مجاني (بلا Credit) |
| POST | `/:id/feedback` | `{rating, comment?, categories?}` | |
| POST | `/:id/quality-check` | — | إعادة الفحص (1 Credit) |

---

## 6. المستخدم

| Method | Path | الوصف |
|---|---|---|
| GET | `/api/dashboard` | إحصاءات + آخر المعاريض + الجهات الأكثر استخداماً |
| GET | `/api/favorites?type=` | المفضلة |
| POST | `/api/favorites` | `{type, targetId}` |
| DELETE | `/api/favorites/:id` | |
| GET | `/api/credits` | الرصيد + آخر 50 حركة |
| GET | `/api/account/export` | تصدير كل بيانات المستخدم JSON |

---

## 7. الإدارة — `/api/admin` 🛡

كل المسارات تتطلب `ADMIN` أو `SUPER_ADMIN`، وكلها تُسجَّل في `AuditLog`.

| المورد | العمليات |
|---|---|
| `/departments` | `GET · POST · PATCH /:id · DELETE /:id · POST /reorder` |
| `/request-types` | نفسها + `POST /:id/attach-department` |
| `/questions` | نفسها + `POST /reorder` + `POST /duplicate` |
| `/questions/:id/options` | `GET · POST · PATCH · DELETE` |
| `/questions/:id/conditions` | `GET · POST · PATCH · DELETE` — يرفض إنشاء دورة |
| `/templates` | `GET · POST · PATCH · DELETE · POST /:id/preview` |
| `/prompts` | `GET · POST · PATCH · DELETE · POST /:id/test` |
| `/users` | `GET · GET /:id · PATCH /:id` (الدور/الحالة/الرصيد) |
| `/letters` | `GET` (قراءة فقط، بلا محتوى إلا بصلاحية `SUPER_ADMIN`) |
| `/plans` | `GET · POST · PATCH` |
| `/settings` | `GET · PATCH` |
| `/analytics` | `GET /overview · /funnel · /departments · /ai-usage · /costs` |
| `/audit-logs` | `GET` |

**`POST /prompts/:id/test`** — يشغّل الـ Prompt على بيانات وهمية ويُرجع المخرَج والتكلفة، بلا حفظ.
هذه أهم أداة لجودة المنتج: تتيح ضبط الصياغة بلا نشر وبلا استهلاك رصيد المستخدمين.

---

## 8. الحدود والتخزين المؤقت

- كل مسارات `POST/PATCH/DELETE` تفحص `Origin`.
- `GET /departments` و`/request-types` مُخزَّنة (`s-maxage=3600`, وسم `catalog`) وتُبطَل عند أي تعديل إداري.
- الترقيم: قائمة المعاريض **Cursor-based** (`cursor` = `createdAt|id`)؛ باقي القوائم Offset.
- الحد الأقصى `limit` = 100.
