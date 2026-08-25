-- ============================================================================
--  فهارس لا يستطيع مخطط Prisma التعبير عنها
--  المرجع: docs/DATABASE.md §5 · docs/DECISIONS.md #D-024
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) تفرّد سجلات النظام
--
-- سجلات النظام تحمل organizationId = NULL، و PostgreSQL يعتبر كل NULL
-- مميّزاً عن الآخر — فقيد @@unique([slug, organizationId]) في المخطط لا
-- يمنع تكرار سجلات النظام فعلياً. الفهرس الجزئي هو ما يفرض التفرّد حقاً.
--
-- القيد المركّب في المخطط يبقى: هو صحيح وفعّال للسجلات المملوكة لمنظمة.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "Department_slug_system_key"
  ON "Department" ("slug") WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "RequestType_slug_system_key"
  ON "RequestType" ("slug") WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Template_slug_system_key"
  ON "Template" ("slug") WHERE "organizationId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_key_system_key"
  ON "Prompt" ("key") WHERE "organizationId" IS NULL;

-- ---------------------------------------------------------------------------
-- 2) البحث النصي في المعاريض
--
-- شاشة «معاريضي» تبحث بـ contains على title و contentText. بلا فهرس يعني
-- ذلك مسحاً كاملاً للجدول يتدهور خطياً مع نمو البيانات.
--
-- pg_trgm + GIN يجعل LIKE '%…%' قابلاً للفهرسة — وهو النمط الوحيد المفيد
-- في البحث العربي، إذ لا تكفي بادئة الكلمة.
--
-- الامتداد قد لا يكون متاحاً على بعض الخدمات المُدارة المقيّدة، فالإنشاء
-- مُغلَّف: فشله لا يُسقط الترحيل، ويبقى البحث يعمل بلا فهرس.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX IF NOT EXISTS "Letter_title_trgm_idx"
    ON "Letter" USING GIN ("title" gin_trgm_ops);

  CREATE INDEX IF NOT EXISTS "Letter_contentText_trgm_idx"
    ON "Letter" USING GIN ("contentText" gin_trgm_ops);
EXCEPTION
  WHEN insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_trgm غير متاح — تخطّي فهارس البحث النصي.';
END
$$;

-- ---------------------------------------------------------------------------
-- 3) تنظيف الجلسات المنتهية
--
-- مهمة التنظيف الدورية تحذف بشرط expiresAt < now(). فهرس جزئي على غير
-- المُبطلة يبقى صغيراً مهما نما الجدول.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "Session_active_expiry_idx"
  ON "Session" ("expiresAt") WHERE "revokedAt" IS NULL;
