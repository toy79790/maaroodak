-- ============================================================================
--  فئات الجهات: من enum إلى جدول يُدار من لوحة التحكم — docs/DECISIONS.md #D-036
--
--  ترحيل بيانات لا مخطط فقط: كل جهة قائمة تُربط بالفئة المقابلة لقيمتها
--  القديمة، فلا تضيع فئة أي جهة.
--
--  الترتيب مقصود: في PostgreSQL ينشئ كل جدول نوعاً مركّباً باسمه، فلا يمكن
--  إنشاء جدول "DepartmentCategory" قبل حذف النوع enum الذي يحمل الاسم نفسه.
--  لذلك تُنسخ القيمة نصاً أولاً، ثم يُحذف العمود والنوع، ثم يُنشأ الجدول.
-- ============================================================================

-- 1) حفظ الفئة الحالية لكل جهة كنص قبل حذف النوع.
ALTER TABLE "Department" ADD COLUMN "categoryId" TEXT;
UPDATE "Department" SET "categoryId" = 'cat_' || lower("category"::text);

-- 2) إزالة العمود القديم وفهرسه ونوعه.
DROP INDEX "Department_category_isActive_idx";
ALTER TABLE "Department" DROP COLUMN "category";
DROP TYPE "DepartmentCategory";

-- 3) جدول الفئات.
CREATE TABLE "DepartmentCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentCategory_slug_key" ON "DepartmentCategory"("slug");
CREATE INDEX "DepartmentCategory_isActive_order_idx" ON "DepartmentCategory"("isActive", "order");

-- 4) الفئات الخمس السابقة — بمعرّفات ثابتة تطابق ما كُتب في الخطوة 1،
--    وبالتسميات نفسها التي كانت تعرضها الواجهة.
INSERT INTO "DepartmentCategory" ("id", "slug", "name", "order", "updatedAt") VALUES
    ('cat_government', 'government', 'جهات حكومية', 10, CURRENT_TIMESTAMP),
    ('cat_service',    'service',    'جهات خدمية',  20, CURRENT_TIMESTAMP),
    ('cat_education',  'education',  'جهات تعليمية', 30, CURRENT_TIMESTAMP),
    ('cat_private',    'private',    'جهات خاصة',   40, CURRENT_TIMESTAMP),
    ('cat_other',      'other',      'أخرى',       50, CURRENT_TIMESTAMP);

-- 5) الربط الإلزامي.
ALTER TABLE "Department" ALTER COLUMN "categoryId" SET NOT NULL;
CREATE INDEX "Department_categoryId_isActive_idx" ON "Department"("categoryId", "isActive");
ALTER TABLE "Department" ADD CONSTRAINT "Department_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DepartmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
