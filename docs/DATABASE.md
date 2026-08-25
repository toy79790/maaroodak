# DATABASE — معروضك

**المحرك:** PostgreSQL 17 · **ORM:** Prisma 6 · **الترحيل:** Prisma Migrate

---

## 1. مبادئ التصميم

1. **المعرّفات** `cuid()` — لا أرقام متسلسلة (تمنع تعداد الموارد).
2. **الحذف الناعم** للكيانات التي يشير إليها التاريخ (`Letter`, `Department`, `Question`) عبر `deletedAt`
   — لأن حذف جهة يجب ألّا يُتلف معاريض قديمة.
3. **`organizationId` قابل للـ null** على كل كيان قابل للتخصيص → `null` = سجل نظام عام.
4. **JSON للبنى المتغيرة فقط** (`answers`, `validation`, `qualityReport`, `meta`) — لا للعلاقات.
5. **دفتر أستاذ للـ Credits** (`CreditTransaction`) — الرصيد الحالي مخزّن للسرعة لكنه **قابل لإعادة الاشتقاق**.
6. **كل عملية AI مُسجّلة** — لا استدعاء بلا سجل تكلفة.
7. **الفهارس تتبع الاستعلامات الفعلية** (§5) لا التخمين.

---

## 2. خريطة العلاقات

```
Organization ─┬─< OrganizationMember >─┬─ User ─┬─< Session
              │                        │        ├─< PasswordResetToken
              ├─< Department            │        ├─< Letter ──< LetterVersion
              ├─< RequestType           │        ├─< InterviewSession
              ├─< Question ──< QuestionOption    ├─< Favorite
              │        └──< QuestionCondition    ├─< CreditTransaction
              ├─< Template                       ├─< AIUsage
              ├─< Prompt                         ├─< Feedback
              └─< Subscription >── Plan          └─< AuditLog

Department ─< DepartmentRequestType >─ RequestType
Department / RequestType ──< Question  (نطاق السؤال)
Department / RequestType ──< Template  (اختيار القالب)
Department / RequestType ──< Prompt    (اختيار الـ Prompt)
Letter ─── Department · RequestType · Template
```

---

## 3. الكيانات

### الهوية والصلاحيات

| الجدول | الحقول المحورية | ملاحظات |
|---|---|---|
| `User` | `email` (فريد، lowercase), `passwordHash`, `name`, `phone`, `nationalId`, `city`, `role`, `creditBalance`, `emailVerifiedAt`, `lastLoginAt` | `nationalId` و`phone` تُملأ من الملف الشخصي وتُستخدم كمتغيرات قالب — تقلّل الأسئلة المتكررة |
| `Session` | `tokenHash`, `expiresAt`, `ip`, `userAgent`, `revokedAt` | نخزّن **hash** الرمز لا الرمز — تسريب القاعدة لا يمنح جلسات |
| `PasswordResetToken` | `tokenHash`, `expiresAt`, `usedAt` | صالح 30 دقيقة، استخدام واحد |
| `Organization` | `slug`, `name`, `planId`, `creditBalance` | جاهز للـ Multi-tenant |
| `OrganizationMember` | `(organizationId, userId)` فريد, `role` | OWNER / ADMIN / MEMBER |

**الأدوار:** `UserRole = USER | ADMIN | SUPER_ADMIN` — enum لا جدول.
السبب: مجموعة مغلقة، والصلاحيات تُشتق منها في `lib/auth/rbac.ts` كخريطة صريحة قابلة للاختبار.
(إن لزم لاحقاً صلاحيات مخصّصة لكل منظمة، يُضاف جدول `Permission` دون كسر ما سبق.)

### الكتالوج

| الجدول | الحقول المحورية |
|---|---|
| `Department` | `slug`, `name`, `nameEn`, `category`, `description`, `logoUrl`, `addressee` (صيغة المخاطبة: «سعادة/معالي…»), `honorific`, `order`, `isActive`, `organizationId`, `deletedAt` |
| `RequestType` | `slug`, `name`, `description`, `icon`, `order`, `isActive`, `organizationId` |
| `DepartmentRequestType` | `(departmentId, requestTypeId)` فريد, `order`, `isActive`, `templateId?`, `promptId?` |

`DepartmentRequestType` هي التي تُحقّق «تختلف الخيارات حسب الجهة»، وتسمح بربط قالب/Prompt خاص بكل ثنائية.

### محرك الأسئلة

| الجدول | الحقول المحورية |
|---|---|
| `Question` | `key` (مفتاح المتغير في القالب), `label`, `description`, `type`, `required`, `placeholder`, `helpText`, `order`, `groupKey`, `departmentId?`, `requestTypeId?`, `validation Json`, `aiHint`, `isActive`, `organizationId` |
| `QuestionOption` | `questionId`, `value`, `label`, `order` |
| `QuestionCondition` | `targetQuestionId`, `action`, `logic`, `clauses Json[]`, `order` |

**نطاق السؤال (Scope)** — القاعدة الثلاثية:
```
departmentId = null, requestTypeId = null  →  سؤال عام لكل معروض      (الاسم، المدينة…)
departmentId = null, requestTypeId = X     →  لكل «طلب مساعدة مالية» أياً كانت الجهة
departmentId = Y,    requestTypeId = X     →  خاص بهذه الثنائية فقط
departmentId = Y,    requestTypeId = null  →  لكل طلبات هذه الجهة
```
`QuestionEngine` يجمع الأربعة، يرتّبها بـ `order`، ويُزيل التكرار بـ `key` مع أولوية **الأخص**.

`validation Json` مثال: `{ "min": 1, "max": 500000, "pattern": "^[0-9]{10}$", "maxLength": 1000 }`

### القوالب والـ Prompts

| الجدول | الحقول المحورية |
|---|---|
| `Template` | `name`, `body`, `departmentId?`, `requestTypeId?`, `isDefault`, `isActive`, `version`, `organizationId` |
| `Prompt` | `key`, `type`, `content`, `departmentId?`, `requestTypeId?`, `model?`, `temperature?`, `maxTokens?`, `version`, `isActive`, `organizationId` |

`PromptType = SYSTEM | GENERATION | FOLLOW_UP | QUALITY_CHECK | TOOL_IMPROVE | TOOL_FORMALIZE | TOOL_SHORTEN | TOOL_EXPAND | TOOL_CLARIFY | TOOL_REWRITE | TOOL_TITLE | TOOL_INTRO | TOOL_CONCLUSION | TOOL_PROOFREAD`

اختيار القالب/الـ Prompt يتبع نفس أولوية الأخص: (جهة+نوع) → (نوع) → (جهة) → الافتراضي.

### المعاريض

| الجدول | الحقول المحورية |
|---|---|
| `InterviewSession` | `userId`, `departmentId`, `requestTypeId`, `answers Json`, `currentStep`, `status`, `letterId?`, `lastActiveAt` |
| `Letter` | `userId`, `organizationId?`, `title`, `subject`, `contentHtml`, `contentText`, `answers Json`, `status`, `qualityReport Json?`, `currentVersion`, `isFavorite`, `departmentId`, `requestTypeId`, `templateId?`, `deletedAt` |
| `LetterVersion` | `letterId`, `version`, `title`, `contentHtml`, `source`, `note`, `createdById` | `(letterId, version)` فريد |
| `Feedback` | `letterId`, `userId`, `rating`, `comment`, `categories String[]` |

`Letter.answers` نسخة **مجمّدة** من الإجابات لحظة التوليد — لو تغيّر السؤال لاحقاً لا يتأثر المعروض.

### الفوترة والاستهلاك

| الجدول | الحقول المحورية |
|---|---|
| `Plan` | `key`, `name`, `priceMonthly`, `currency`, `lettersPerMonth`, `creditsPerMonth`, `features Json`, `order`, `isActive` |
| `Subscription` | `userId?`, `organizationId?`, `planId`, `status`, `periodStart`, `periodEnd`, `cancelAtPeriodEnd`, `provider`, `externalId` |
| `CreditTransaction` | `userId`, `organizationId?`, `amount` (موجب/سالب), `balanceAfter`, `reason`, `referenceId?`, `meta Json` |
| `AIUsage` | `userId?`, `organizationId?`, `letterId?`, `operation`, `provider`, `model`, `inputTokens`, `outputTokens`, `costUsd Decimal(12,6)`, `latencyMs`, `status`, `errorCode?` |

`CreditReason = SIGNUP_BONUS | PLAN_GRANT | ADMIN_ADJUST | GENERATE_LETTER | AI_TOOL | REGENERATE | REFUND | EXPIRE`

**قاعدة الاتساق:** الخصم وتسجيل `AIUsage` وإنشاء `Letter` داخل **معاملة واحدة** (`$transaction`).
إن فشل نداء الـ AI → لا خصم. إن نجح النداء وفشل الحفظ → يُسجّل `AIUsage` بحالة `ORPHANED` للمحاسبة.

### النظام والرصد

| الجدول | الحقول المحورية |
|---|---|
| `SystemSetting` | `key` فريد, `value Json`, `updatedById` |
| `AuditLog` | `actorId?`, `action`, `entity`, `entityId?`, `before Json?`, `after Json?`, `ip`, `userAgent` |
| `AnalyticsEvent` | `userId?`, `anonymousId?`, `name`, `props Json`, `createdAt` |
| `Favorite` | `userId`, `type`, `targetId` — `(userId,type,targetId)` فريد |

`AnalyticsEvent` هي مصدر مقاييس القمع: `interview_started`, `question_answered`, `interview_abandoned`, `letter_generated`, `letter_exported`, `ai_tool_used`.

---

## 4. التعدادات (Enums)

```
UserRole              USER · ADMIN · SUPER_ADMIN
OrgRole               OWNER · ADMIN · MEMBER
DepartmentCategory    GOVERNMENT · SERVICE · EDUCATION · PRIVATE · OTHER
QuestionType          TEXT · TEXTAREA · NUMBER · DATE · SELECT · RADIO · CHECKBOX · YES_NO · FILE
ConditionAction       SHOW · HIDE · REQUIRE · OPTIONAL
ConditionLogic        AND · OR
ConditionOperator     EQUALS · NOT_EQUALS · IN · NOT_IN · CONTAINS · NOT_CONTAINS ·
                      GT · GTE · LT · LTE · IS_EMPTY · IS_NOT_EMPTY · IS_TRUE · IS_FALSE
PromptType            (انظر §3)
LetterStatus          DRAFT · GENERATING · GENERATED · EDITED · COMPLETED · ARCHIVED · FAILED
VersionSource         AI_GENERATED · USER_EDIT · AI_TOOL · RESTORED
InterviewStatus       IN_PROGRESS · COMPLETED · ABANDONED · CONVERTED
FavoriteType          DEPARTMENT · TEMPLATE · LETTER
SubscriptionStatus    ACTIVE · TRIALING · PAST_DUE · CANCELED · EXPIRED
CreditReason          (انظر §3)
AIOperation           GENERATE · FOLLOW_UP · QUALITY_CHECK · IMPROVE · FORMALIZE · SHORTEN ·
                      EXPAND · CLARIFY · REWRITE · TITLE · INTRO · CONCLUSION · PROOFREAD
AIStatus              SUCCESS · FAILED · BLOCKED · TIMEOUT · ORPHANED
FeedbackRating        THUMBS_UP · THUMBS_DOWN
```

---

## 5. الفهارس — مشتقّة من الاستعلامات الفعلية

| الاستعلام | الفهرس |
|---|---|
| «معاريضي» مرتّبة زمنياً + فلتر | `Letter(userId, deletedAt, createdAt DESC)` |
| فلترة بالجهة | `Letter(userId, departmentId)` · `Letter(userId, status)` |
| قائمة الجهات النشطة | `Department(organizationId, isActive, order)` · `Department(slug, organizationId)` فريد |
| أنواع الطلبات لجهة | `DepartmentRequestType(departmentId, isActive, order)` |
| أسئلة النطاق | `Question(departmentId, requestTypeId, isActive, order)` · `Question(organizationId, isActive)` |
| شروط سؤال | `QuestionCondition(targetQuestionId)` |
| نسخ المعروض | `LetterVersion(letterId, version DESC)` فريد مركّب |
| استئناف المقابلة | `InterviewSession(userId, status, lastActiveAt DESC)` |
| تقارير التكلفة | `AIUsage(createdAt)` · `AIUsage(userId, createdAt)` · `AIUsage(model, createdAt)` |
| رصيد وحركات | `CreditTransaction(userId, createdAt DESC)` |
| قمع التحليلات | `AnalyticsEvent(name, createdAt)` |
| الجلسات | `Session(tokenHash)` فريد · `Session(userId, expiresAt)` |
| المفضلة | `Favorite(userId, type)` |
| التدقيق | `AuditLog(entity, entityId)` · `AuditLog(actorId, createdAt DESC)` |

**البحث النصي:** `Letter(title)` و`Letter(contentText)` عبر `pg_trgm` + فهرس GIN
(يُضاف كـ migration يدوية `20xx_search_indexes` لأن Prisma لا يولّده).

---

## 6. سياسة الحذف

| العلاقة | السلوك | السبب |
|---|---|---|
| `User` → `Letter` | `Cascade` | حذف الحساب يحذف بياناته (GDPR-like) |
| `Letter` → `LetterVersion` | `Cascade` | النسخ بلا معنى بلا المعروض |
| `Department` → `Letter` | `Restrict` + حذف ناعم للجهة | لا نُتلف تاريخ المستخدم |
| `Question` → `QuestionOption` | `Cascade` | |
| `Question` → `QuestionCondition` | `Cascade` على `targetQuestionId` | |
| `Plan` → `Subscription` | `Restrict` | لا تُحذف خطة مستخدمة |
| `User` → `AIUsage` | `SetNull` | نحتفظ بالمحاسبة بعد حذف الحساب |

---

## 7. البذور (Seed)

`prisma/seed.ts` يزرع — بشكل **متكرّر الأمان (idempotent)** عبر `upsert` على `slug`/`key`:

- **20 جهة**: 16 حكومية + خدمية + تعليمية + خاصة + «جهة أخرى»
- **21 نوع طلب** عام + ربطها بالجهات المناسبة (`DepartmentRequestType`)
- **أسئلة عامة** (الاسم، الهوية، الجوال، المدينة) + أسئلة لكل نوع طلب + أسئلة خاصة بثنائيات مهمة
- **شروط**: سلسلة «هل لديك مديونية؟ → 5 أسئلة فرعية» وغيرها
- **قوالب**: افتراضي حكومي، ملكي/إماري، خدمي/تجاري، تعليمي، شكوى/تظلم
- **Prompts**: System + Generation + Follow-up + Quality + 10 أدوات
- **خطط**: Free (3) · Basic (20) · Pro (100) · Business (1000)
- **إعدادات النظام** + حساب Admin + حساب مستخدم تجريبي

---

## 8. التشغيل المحلي

لا يوجد Docker ولا PostgreSQL مثبّت على جهاز التطوير، لذلك:

```bash
npm run db:start     # PostgreSQL 17 حقيقية (ثنائيات مضمّنة) على 5433 — بلا صلاحيات مدير
npm run db:migrate   # يطبّق الترحيلات وينشئ ترحيلاً جديداً عند تغيّر المخطط
npm run db:seed
```

في الإنتاج: أي PostgreSQL مُدار عبر `DATABASE_URL` — لا فرق في المخطط.
انظر `DECISIONS.md #D-004`.

---

## 9. سياسة الترحيل

### القاعدة الحاكمة

> **`prisma db push` ممنوع على أي قاعدة فيها بيانات.**

`db push` يوفّق المخطط بالقوة: قد **يحذف عموداً فيه بيانات** بلا سجل ولا
تراجع ولا سؤال. مناسب للتجريب السريع على قاعدة يمكن رميها، وكارثي على قاعدة
مستخدمين. لهذا حُذف من أوامر المشروع.

### الأوامر

| الأمر | البيئة | ما يفعله |
|---|---|---|
| `npm run db:migrate` | تطوير | يقارن المخطط بالقاعدة، ينشئ ملف ترحيل، يطبّقه |
| `npm run db:migrate:create` | تطوير | ينشئ الترحيل بلا تطبيق — لمراجعة SQL أو تعديله يدوياً |
| `npm run db:deploy` | **إنتاج** | يطبّق الترحيلات المُودَعة فقط. لا يُنشئ ولا يحذف من تلقائه |
| `npm run db:migrate:status` | الكل | يعرض ما طُبّق وما ينتظر |
| `npm run db:reset` | تطوير فقط | يمسح القاعدة ويعيد بناءها من الصفر |

### دورة العمل

```
تعديل prisma/schema.prisma
        │
        ▼
npm run db:migrate  ──▶  prisma/migrations/<طابع زمني>_<اسم>/migration.sql
        │
        ▼
راجع ملف SQL — خصوصاً DROP و ALTER … NOT NULL
        │
        ▼
git commit  (الترحيل جزء من الشيفرة لا أثر جانبي لها)
        │
        ▼
CI يطبّقه على قاعدة نظيفة  ──▶  يُثبت أنه يعمل من الصفر
        │
        ▼
النشر ينفّذ prisma migrate deploy
```

### الترحيلات الحالية

| الترحيل | المحتوى |
|---|---|
| `20260825000000_init` | المخطط الكامل — 26 جدولاً وكل التعدادات والفهارس |
| `20260825000100_system_indexes` | فهارس لا يعبّر عنها مخطط Prisma (أدناه) |

### ترحيلات آمنة

تغييرات تُطبَّق بلا انقطاع:

- إضافة جدول أو فهرس
- إضافة عمود **قابل للـ null** أو بقيمة افتراضية
- توسيع نوع (`VARCHAR(50)` → `TEXT`)
- إضافة قيمة إلى `enum`

تغييرات تحتاج خطوتين على الأقل:

| التغيير | الطريقة الآمنة |
|---|---|
| حذف عمود | (1) أوقف الكتابة فيه وانشر · (2) احذفه في ترحيل لاحق |
| إعادة تسمية عمود | (1) أضف الجديد وانسخ · (2) بدّل الكتابة · (3) احذف القديم |
| `NULL` → `NOT NULL` | (1) عبّئ الصفوف الفارغة · (2) أضف القيد |
| حذف قيمة من `enum` | رحّل الصفوف أولاً — PostgreSQL يرفض الحذف إن كانت مستخدمة |

**خذ نسخة احتياطية قبل أي ترحيل يحذف أو يضيّق.** استرجاع نسخة أرخص بكثير من
إعادة بناء بيانات ضاعت.

### فهارس خارج مخطط Prisma

`20260825000100_system_indexes` ينشئ ما لا يستطيع Prisma التعبير عنه:

| الفهرس | السبب |
|---|---|
| `*_slug_system_key` (4 فهارس جزئية) | `@@unique` مع عمود قابل للـ null **لا يمنع التكرار** في PostgreSQL — كل NULL مميّز. الفهرس الجزئي `WHERE "organizationId" IS NULL` هو ما يفرض التفرّد فعلياً |
| `Letter_*_trgm_idx` | `pg_trgm` + GIN يجعل `LIKE '%…%'` قابلاً للفهرسة — النمط الوحيد المفيد في البحث العربي |
| `Session_active_expiry_idx` | فهرس جزئي على الجلسات غير المُبطلة — يبقى صغيراً مهما نما الجدول |

إنشاء `pg_trgm` مُغلَّف بـ `EXCEPTION`: بعض الخدمات المُدارة تمنع الامتدادات،
وفشلها يجب ألّا يُسقط الترحيل — البحث يعمل بلا فهرس، أبطأ فقط.

### قاعدة قائمة بلا سجل ترحيلات

إن كانت لديك قاعدة أُنشئت بـ `db push`، اربطها بالترحيلات بلا إعادة بناء:

```bash
npx prisma migrate resolve --applied 20260825000000_init
npx prisma migrate resolve --applied 20260825000100_system_indexes
npx prisma migrate status   # يجب أن يقول: up to date
```

### النسخ الاحتياطي

```bash
pg_dump "$DATABASE_URL" --format=custom --file=maroudak-$(date +%F).dump
pg_restore --dbname="$RESTORE_URL" --clean --if-exists maroudak-2026-08-25.dump
```

`pg_dump` يغطي كل الجداول. تفاصيل التغطية والجدولة في
[DEPLOYMENT.md §12](DEPLOYMENT.md).
