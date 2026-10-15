import { Markdown } from "@/components/primitives/Markdown";

type Section = { heading: string | null; body: string };

type Props = {
  sections: Section[];
  busy?: boolean;
};

/** Read-only streamed/generated draft canvas. Bodies render as formatted Markdown. */
export function StreamCanvas({ sections, busy }: Props) {
  if (busy && sections.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
        Composing…
      </div>
    );
  }
  if (sections.length === 0) return null;
  return (
    <article className="space-y-6">
      {sections.map((s, i) => (
        <section key={i} className="rounded-2xl border border-border bg-surface px-6 py-6 sm:px-8">
          {s.heading && (
            <header className="mb-4">
              <div className="mb-2 h-0.5 w-8 rounded-full bg-accent" aria-hidden />
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {s.heading}
              </h2>
            </header>
          )}
          <Markdown className="[&>p:first-of-type]:text-base [&>p:first-of-type]:leading-[1.8]">
            {s.body}
          </Markdown>
        </section>
      ))}
    </article>
  );
}
