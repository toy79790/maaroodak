import { Container } from '@/components/ui/container';
import { LEGAL_LAST_UPDATED, type LegalSection } from '@/features/marketing/legal-content';

/** تخطيط موحّد للصفحات القانونية. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}) {
  return (
    <Container className="max-w-3xl py-16 sm:py-20">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">{intro}</p>
      <p className="mt-2 text-xs text-subtle-foreground">
        آخر تحديث: {LEGAL_LAST_UPDATED}
      </p>

      <div className="mt-10 space-y-9">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>

            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="mt-3 leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}

            {section.bullets ? (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet.slice(0, 32)}
                    className="flex gap-2.5 leading-relaxed text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-2.5 inline-block size-1.5 shrink-0 rounded-full bg-primary"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </Container>
  );
}
