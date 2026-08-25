export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy>
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="skeleton mb-3 h-7 w-64 rounded-lg" />
      <div className="skeleton mb-8 h-4 w-80 rounded-lg" />
      <div className="skeleton mb-6 h-12 w-full rounded-[var(--radius-field)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="skeleton h-24 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
