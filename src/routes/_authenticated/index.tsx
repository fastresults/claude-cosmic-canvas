import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Sparkles, Target } from "lucide-react";
import { Orb } from "@/components/primitives/Orb";

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
          <CyclingSuggestion suggestions={SUGGESTIONS} onPick={generate} />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/create"
              className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent/20"
            >
              <Sparkles className="h-4 w-4 text-accent" />
              Browse 40+ formats
            </Link>
            <Link
              to="/workspaces"
              className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/40"
            >
              <Target className="h-4 w-4 text-accent" />
              Milestones
            </Link>
          </div>
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

function CyclingSuggestion({
  suggestions,
  onPick,
}: {
  suggestions: readonly string[];
  onPick: (s: string) => void;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % suggestions.length), 3500);
    return () => clearInterval(t);
  }, [paused, suggestions.length]);

  const current = suggestions[i];
  const next = () => setI((v) => (v + 1) % suggestions.length);

  return (
    <div
      className="flex items-center gap-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button
        type="button"
        onClick={() => onPick(current)}
        aria-label={`Try: ${current}. Tap to use.`}
        className="group relative overflow-hidden rounded-full border border-border/60 bg-surface px-4 py-1.5 text-sm text-foreground transition-colors hover:border-accent/40"
      >
        <span aria-live="polite" className="block min-w-[14rem] text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={i}
              initial={{ opacity: 0, y: reduce.current ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce.current ? 0 : -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="inline-block"
            >
              {current}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next idea"
        className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
