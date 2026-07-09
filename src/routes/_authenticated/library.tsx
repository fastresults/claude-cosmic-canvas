import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { DraftCard } from "@/components/primitives/DraftCard";
import { listRecentDrafts } from "@/lib/content/content.functions";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

function Library() {
  const listFn = useServerFn(listRecentDrafts);
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["drafts", "recent"],
    queryFn: () => listFn(),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-40">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every draft Eve has made for you. Every one is a Brain node.
        </p>
      </header>

      <div className="space-y-3">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {!isLoading && drafts.length === 0 && (
          <DraftCard
            state="empty"
            format="Post"
            domain="—"
            body="Nothing here yet. Hold the orb on Home to draft your first post."
          />
        )}
        {drafts.map((d) => {
          const score = (d.score ?? {}) as {
            total?: number;
            voiceMatch?: number;
          };
          return (
            <DraftCard
              key={d.id}
              state="done"
              format={d.format}
              domain="Eve"
              body={d.body}
              imageUrl={d.image_url ?? undefined}
              score={{
                total: score.total ?? 0,
                voiceMatch: score.voiceMatch ?? 0,
              }}
              sourceCount={1}
            />
          );
        })}
      </div>
    </div>
  );
}
