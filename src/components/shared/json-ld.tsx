/**
 * بيانات منظّمة (schema.org) — تُحسّن فهم محركات البحث للصفحة.
 *
 * يُهرَّب `<` دائماً: نصّ يحوي `</script>` يغلق الوسم مبكراً ويحوّل الباقي
 * إلى ترميز في الصفحة. القاعدة تُطبَّق دائماً لا حين يُشتبه بالمصدر فقط.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\u003c') }}
    />
  );
}
