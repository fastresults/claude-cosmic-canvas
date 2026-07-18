// Blocking gate for a pillar settings page. If an earlier pillar isn't
// set, replaces the page with a warm CTA that deep-links to the correct
// step. Once every pillar is set, this is a no-op.
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight, HelpCircle, Sparkles, Mic, BookOpen, Compass, Users } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";
import { WhyInOrderSheet } from "@/components/onboarding/WhyInOrderSheet";

type PillarMeta = {
  slot: DefaultSlot;
  label: string;
  to: string;
  icon: typeof Mic;
  blurb: string;
  reassurance: string;
};

const ORDER: PillarMeta[] = [
  {
    slot: "voice",
    label: "Voice",
    to: "/settings/voice",
    icon: Mic,
    blurb: "Teach Eve how you sound.",
    reassurance: "Record 30 seconds or paste 3 things you've written. No wrong answers.",
  },
  {
    slot: "knowledge",
    label: "Knowledge",
    to: "/settings/knowledge",
    icon: BookOpen,
    blurb: "What Eve knows about you and your work.",
    reassurance: "Paste a bio, upload a resume, or import LinkedIn. Whatever's easiest.",
  },
  {
    slot: "domain",
    label: "Domain",
    to: "/settings/domains",
    icon: Compass,
    blurb: "The topics you're an expert in.",
    reassurance: "Pick from suggestions or type your own. You can add more later.",
  },
  {
    slot: "audience",
    label: "Audience",
    to: "/settings/audiences",
    icon: Users,
    blurb: "Who you're writing for.",
    reassurance: "Eve drafts this for you based on your previous steps. Just confirm.",
  },
];

export function PillarLockGate({
  pillar,
  children,
}: {
  pillar: DefaultSlot;
  children: ReactNode;
}) {
  const d = useUserDefaults();
  const [whyOpen, setWhyOpen] = useState(false);
  if (d.loading) return null;

  const values: Record<DefaultSlot, boolean> = {
    voice: !!d.voice,
    knowledge: !!d.knowledge,
    domain: !!d.domain,
    audience: !!d.audience,
  };

  const targetIndex = ORDER.findIndex((p) => p.slot === pillar);
  const blocker = ORDER.slice(0, targetIndex).find((p) => !values[p.slot]);

  if (!blocker) return <>{children}</>;

  const Icon = blocker.icon;
  return (
    <>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
        <div className="overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-transparent p-6">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            <Lock className="h-3 w-3" />
            One step at a time
          </div>
          <h2 className="font-display text-2xl text-foreground">
            Let's set your {blocker.label} first
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{blocker.blurb}</p>
          <p className="mt-2 text-xs text-muted-foreground/90">
            {blocker.reassurance}
          </p>

          <Link
            to={blocker.to}
            search={{ setup: 1 } as never}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm hover:brightness-110"
          >
            <Icon className="h-4 w-4" />
            Set up {blocker.label}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            <span>Voice → Knowledge → Domain → Audience</span>
          </div>

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
