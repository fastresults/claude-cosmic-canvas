// Wraps content-creating surfaces. If Voice / Knowledge / Domain / Audience
// defaults aren't all set, warmly nudges the user to the first missing
// pillar. One CTA — no shortcuts, no jargon.
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, ArrowRight, Sparkles, HelpCircle } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";
import { WhyInOrderSheet } from "@/components/onboarding/WhyInOrderSheet";

type Props = { children: ReactNode; title?: string; description?: string };

const STEPS: {
  slot: DefaultSlot;
  label: string;
  to: string;
  blurb: string;
  seconds: number;
}[] = [
  {
    slot: "voice",
    label: "Voice",
    to: "/settings/voice",
    blurb: "Teach Eve how you sound. Takes about 45 seconds.",
    seconds: 45,
  },
  {
    slot: "knowledge",
    label: "Knowledge",
    to: "/settings/knowledge",
    blurb: "Give Eve the essentials about you and your work.",
    seconds: 30,
  },
  {
    slot: "domain",
    label: "Domain",
    to: "/settings/domains",
    blurb: "Pick the topics you're an expert in.",
    seconds: 15,
  },
  {
    slot: "audience",
    label: "Audience",
    to: "/settings/audiences",
    blurb: "Eve drafts your audience for you — just confirm.",
    seconds: 30,
  },
];

export function RequireDefaultsGate({ children, title, description }: Props) {
  const d = useUserDefaults();
  const [whyOpen, setWhyOpen] = useState(false);
  if (d.loading) return null;
  if (d.ready) return <>{children}</>;

  const done: Record<DefaultSlot, boolean> = {
    voice: !!d.voice,
    knowledge: !!d.knowledge,
    domain: !!d.domain,
    audience: !!d.audience,
  };
  const next = STEPS.find((s) => !done[s.slot])!;
  const completed = STEPS.filter((s) => done[s.slot]).length;
  const percent = Math.round((completed / STEPS.length) * 100);
  const secondsLeft = STEPS.reduce(
    (acc, s) => acc + (done[s.slot] ? 0 : s.seconds),
    0,
  );

  return (
    <>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            <Sparkles className="h-3 w-3" />
            One step at a time
          </div>
          <h2 className="font-display text-2xl text-foreground">
            {title ?? `Let's set your ${next.label} first`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {description ?? next.blurb}
          </p>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {completed} of {STEPS.length} done · {percent}%
              </span>
              <span>~{secondsLeft}s to finish</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <ol className="mt-4 flex flex-col gap-2">
            {STEPS.map((s, i) => {
              const isDone = done[s.slot];
              const isNext = s.slot === next.slot;
              return (
                <li
                  key={s.slot}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    isDone
                      ? "border-border bg-surface"
                      : isNext
                        ? "border-accent bg-accent/10"
                        : "border-border/60 bg-surface-elev opacity-60"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full ${
                      isDone
                        ? "bg-accent/20 text-accent"
                        : isNext
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isNext ? (
                      <ArrowRight className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {i + 1}. {s.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.blurb}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <Link
            to={next.to}
            search={{ setup: 1 } as never}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-110"
          >
            Continue — {next.label}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={() => setWhyOpen(true)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-3 w-3" />
            Why do I have to do this in order?
          </button>
        </div>
      </div>
      <WhyInOrderSheet open={whyOpen} onOpenChange={setWhyOpen} />
    </>
  );
}
