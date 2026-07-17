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
    <article className="space-y-4">
      {sections.map((s, i) => (
        <section key={i} className="rounded-2xl border border-border bg-surface p-4">
          {s.heading && <h2 className="font-display text-lg text-foreground">{s.heading}</h2>}
          <div className="mt-2">
            <Markdown>{s.body}</Markdown>
          </div>
        </section>
      ))}
    </article>
  );
}

