// Persistent 4-pillar setup progress strip. Renders only while the user
// hasn't finished all four pillars. Enforces the order Voice → Knowledge →
// Domain → Audience: earlier steps are unlocked, later steps show a padlock
// and a toast when tapped out of turn.
import { Link } from "@tanstack/react-router";
import { Check, Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

type Step = {
  slot: DefaultSlot;
  label: string;
  to: string;
};

const STEPS: Step[] = [
  { slot: "voice", label: "Voice", to: "/settings/voice" },
  { slot: "knowledge", label: "Knowledge", to: "/settings/knowledge" },
  { slot: "domain", label: "Domain", to: "/settings/domains" },
  { slot: "audience", label: "Audience", to: "/settings/audiences" },
];

export function SetupJourneyStrip() {
  const d = useUserDefaults();
  if (d.loading || d.ready) return null;

  const done: Record<DefaultSlot, boolean> = {
    voice: !!d.voice,
    knowledge: !!d.knowledge,
    domain: !!d.domain,
    audience: !!d.audience,
  };
  // First unmet step in strict order.
  const activeIndex = STEPS.findIndex((s) => !done[s.slot]);
  const completed = STEPS.filter((s) => done[s.slot]).length;

  return (
    <div className="border-b border-accent/30 bg-accent/10 px-4 py-2">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-accent">
              Set up Eve — {completed} of {STEPS.length} done
            </span>
            <span className="text-muted-foreground">Do these in order</span>
          </div>
          <ol className="flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const isDone = done[s.slot];
              const isActive = i === activeIndex;
              const isLocked = !isDone && !isActive;
              const content = (
                <div
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    isDone
                      ? "bg-accent/20 text-accent"
                      : isActive
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-elev text-muted-foreground"
                  }`}
                >
                  <span className="grid h-4 w-4 place-items-center">
                    {isDone ? (
                      <Check className="h-3 w-3" />
                    ) : isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                  </span>
                  <span>{s.label}</span>
                </div>
              );
              return (
                <li key={s.slot} className="flex items-center gap-1.5">
                  {isLocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        toast.message(
                          `Finish ${STEPS[activeIndex]?.label ?? "the previous step"} first`,
                          { description: "Setup is guided — one step at a time." },
                        )
                      }
                      className="cursor-not-allowed opacity-70"
                    >
                      {content}
                    </button>
                  ) : (
                    <Link to={s.to} className="hover:opacity-90">
                      {content}
                    </Link>
                  )}
                  {i < STEPS.length - 1 && (
                    <span className="h-px w-3 bg-border" aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
