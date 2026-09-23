-- ============================================================================
--  عدّاد أدوات الذكاء الاصطناعي لكل معروض — docs/DECISIONS.md #D-046
--
--  الحد (#D-042) كان يُعدّ من الدفتر قبل النداء، والدفتر لا يُكتب إلا بعده:
--  طلبات متزامنة ترى العدد نفسه وتمرّ كلها. العمود يُحجز ذرّياً قبل النداء.
--
--  ترحيل بيانات: العدّاد يبدأ من عدد حركات AI_TOOL القائمة لكل معروض.
-- ============================================================================

ALTER TABLE "Letter" ADD COLUMN "aiToolUses" INTEGER NOT NULL DEFAULT 0;

UPDATE "Letter" AS l
SET "aiToolUses" = used.n
FROM (
  SELECT "referenceId", COUNT(*)::int AS n
  FROM "CreditTransaction"
  WHERE "reason" = 'AI_TOOL' AND "referenceId" IS NOT NULL
  GROUP BY "referenceId"
) AS used
WHERE used."referenceId" = l."id";
