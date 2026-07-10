import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Target } from "lucide-react";
import { Orb } from "@/components/primitives/Orb";
import { Pill } from "@/components/primitives/Pill";
import { DraftCard } from "@/components/primitives/DraftCard";
import { useWorkingDraft } from "@/lib/content/working-draft";

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
  const { draft, busy, saving, error, generate, refine, save, discard } =
    useWorkingDraft();

  // Pick up seeded prompt from Brain "Ask Eve".
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || typeof window === "undefined") return;
    const seed = window.sessionStorage.getItem("eve:seed-prompt");
    if (seed) {
      seeded.current = true;
      window.sessionStorage.removeItem("eve:seed-prompt");
      void generate(seed);
    }
  }, [generate]);



  const showEmpty = !draft && !busy;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-40 pt-8">
      {showEmpty ? (
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
              <button key={s} onClick={() => generate(s)}>
                <Pill variant="ghost" size="sm">
                  {s}
                </Pill>
              </button>
            ))}
          </div>
          <Link
            to="/create"
            className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent/20"
          >
            <Sparkles className="h-4 w-4 text-accent" />
            Browse 40+ formats
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-foreground">
                Working draft
              </h1>
              <p className="text-xs text-muted-foreground">
                Refine it, then save to your Library.
              </p>
            </div>
            <Orb size={56} />
          </header>

          {busy && !draft && (
            <DraftCard
              state="streaming"
              mode="working"
              format="post"
              domain="Eve"
              body="Composing…"
            />
          )}

          {draft && (
            <DraftCard
              state="done"
              mode="working"
              format={draft.format}
              domain="Eve"
              body={draft.body}
              busy={busy || saving}
              onRefine={(kind) => void refine(kind)}
              onSave={() => void save()}
              onDiscard={discard}
            />
          )}

          {error && (
            <p className="px-1 text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
