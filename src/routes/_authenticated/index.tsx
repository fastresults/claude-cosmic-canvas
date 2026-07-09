import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Orb } from "@/components/primitives/Orb";
import { Pill } from "@/components/primitives/Pill";
import { DraftCard } from "@/components/primitives/DraftCard";
import { contentDraft, listRecentDrafts } from "@/lib/content/content.functions";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

const SUGGESTIONS = [
  "Draft a LinkedIn post about our v2 launch",
  "A punchy tweet on this week's shipping progress",
  "Reply to the pricing thread — friendly but firm",
  "Hot take on the AI news cycle",
];

function Home() {
  const listFn = useServerFn(listRecentDrafts);
  const draftFn = useServerFn(contentDraft);
  const qc = useQueryClient();

  const { data: drafts = [] } = useQuery({
    queryKey: ["drafts", "recent"],
    queryFn: () => listFn(),
  });

  const mutation = useMutation({
    mutationFn: (prompt: string) => draftFn({ data: { prompt, format: "post" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drafts"] }),
  });

  const empty = drafts.length === 0 && !mutation.isPending;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-40 pt-8">
      {empty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center gap-8"
        >
          <Orb size={220} />
          <div className="text-center">
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">
              Hold to speak.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Say one sentence. Eve does the rest.
            </p>
          </div>
          <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => mutation.mutate(s)}>
                <Pill variant="ghost" size="sm">
                  {s}
                </Pill>
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-foreground">Today</h1>
              <p className="text-xs text-muted-foreground">
                {drafts.length} draft{drafts.length === 1 ? "" : "s"} in the queue
              </p>
            </div>
            <Orb size={56} />
          </header>

          <AnimatePresence>
            {mutation.isPending && (
              <DraftCard
                key="streaming"
                state="streaming"
                format="post"
                domain="Eve"
                body="Composing…"
              />
            )}
          </AnimatePresence>

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
      )}
    </div>
  );
}
