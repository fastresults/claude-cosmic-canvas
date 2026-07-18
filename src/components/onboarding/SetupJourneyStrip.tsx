// Persistent 4-pillar setup progress strip with animated progress bar,
// warm copy, and a single primary CTA that always deep-links to the
// active pillar. Hidden on /onboarding, /auth, /terms, /privacy and
// fades out once every pillar is set.
import { Link, useLocation } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

type Step = {
  slot: DefaultSlot;
  label: string;
  to: string;
  seconds: number;
};

const STEPS: Step[] = [
  { slot: "voice", label: "Voice", to: "/settings/voice", seconds: 45 },
  { slot: "knowledge", label: "Knowledge", to: "/settings/knowledge", seconds: 30 },
  { slot: "domain", label: "Domain", to: "/settings/domains", seconds: 15 },
  { slot: "audience", label: "Audience", to: "/settings/audiences", seconds: 30 },
];

const HIDDEN_PATHS = ["/onboarding", "/auth", "/terms", "/privacy"];

export function SetupJourneyStrip() {
  const d = useUserDefaults();
  const location = useLocation();
  const hidden = HIDDEN_PATHS.some((p) => location.pathname.startsWith(p));

  if (d.loading || d.ready || hidden) return null;

  const done: Record<DefaultSlot, boolean> = {
    voice: !!d.voice,
    knowledge: !!d.knowledge,
    domain: !!d.domain,
    audience: !!d.audience,
  };
  const activeIndex = STEPS.findIndex((s) => !done[s.slot]);
  const completed = STEPS.filter((s) => done[s.slot]).length;
  const percent = Math.round((completed / STEPS.length) * 100);
  const secondsLeft = STEPS.slice(activeIndex).reduce(
    (acc, s) => acc + (done[s.slot] ? 0 : s.seconds),
    0,
  );
  const active = STEPS[activeIndex];

  return (
    <AnimatePresence>
      <motion.div
        key="setup-strip"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="border-b border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent px-4 py-2.5"
        role="region"
        aria-label="Setup progress"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Set up Eve · {completed} of {STEPS.length} done
            </span>
            <span className="text-muted-foreground">~{secondsLeft}s left</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="flex items-center gap-2">
            <ol className="flex flex-1 items-center gap-1" aria-live="polite">
              {STEPS.map((s, i) => {
                const isDone = done[s.slot];
                const isActive = i === activeIndex;
                const isLocked = !isDone && !isActive;
                const stateClass = isDone
                  ? "bg-accent/20 text-accent"
                  : isActive
                    ? "bg-accent text-accent-foreground ring-2 ring-accent/40 animate-pulse"
                    : "bg-surface-elev text-muted-foreground";
                const label = (
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${stateClass}`}
                  >
                    {isDone ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : isLocked ? (
                      <Lock className="h-2.5 w-2.5" />
                    ) : (
                      <span className="grid h-2.5 w-2.5 place-items-center text-[9px]">
                        {i + 1}
                      </span>
                    )}
                    <span className="hidden xs:inline">{s.label}</span>
                  </span>
                );
                return (
                  <li key={s.slot}>
                    {isLocked ? (
                      <button
                        type="button"
                        aria-disabled="true"
                        onClick={() =>
                          toast.message(
                            `Finish ${active?.label ?? "the current step"} first`,
                            { description: "Setup is guided — one step at a time." },
                          )
                        }
                      >
                        {label}
                        <span className="sr-only">
                          Locked. Finish {active?.label} first.
                        </span>
                      </button>
                    ) : (
                      <Link to={s.to} search={{ setup: 1 } as never}>
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>

            {active && (
              <Link
                to={active.to}
                search={{ setup: 1 } as never}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground shadow-sm hover:brightness-110"
              >
                Continue → {active.label}
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
