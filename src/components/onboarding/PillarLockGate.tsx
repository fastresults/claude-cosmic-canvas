// Wraps a pillar-settings page. If an earlier pillar in the fixed order
// (Voice → Knowledge → Domain → Audience) isn't set, the page contents are
// replaced with a big friendly CTA that sends the user to the correct step.
// Once every pillar is set, this is a no-op and users can edit any pillar.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight, Mic, BookOpen, Compass, Users } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

type PillarMeta = {
  slot: DefaultSlot;
  label: string;
  to: string;
  icon: typeof Mic;
  blurb: string;
};

const ORDER: PillarMeta[] = [
  { slot: "voice", label: "Voice", to: "/settings/voice", icon: Mic, blurb: "How Eve sounds when it writes as you." },
  { slot: "knowledge", label: "Knowledge", to: "/settings/knowledge", icon: BookOpen, blurb: "What Eve knows about you and your work." },
  { slot: "domain", label: "Domain", to: "/settings/domains", icon: Compass, blurb: "The topics you're an expert in." },
  { slot: "audience", label: "Audience", to: "/settings/audiences", icon: Users, blurb: "Who you're writing for." },
];

export function PillarLockGate({
  pillar,
  children,
}: {
  pillar: DefaultSlot;
  children: ReactNode;
}) {
  const d = useUserDefaults();
  if (d.loading) return null;

  const values: Record<DefaultSlot, boolean> = {
    voice: !!d.voice,
    knowledge: !!d.knowledge,
    domain: !!d.domain,
    audience: !!d.audience,
  };

  const targetIndex = ORDER.findIndex((p) => p.slot === pillar);
  // First unmet pillar earlier than this one.
  const blocker = ORDER.slice(0, targetIndex).find((p) => !values[p.slot]);

  if (!blocker) return <>{children}</>;

  const Icon = blocker.icon;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-accent">
          <Lock className="h-3.5 w-3.5" />
          Locked — one step at a time
        </div>
        <h2 className="font-display text-2xl text-foreground">
          Set your {blocker.label} first
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{blocker.blurb}</p>

        <Link
          to={blocker.to}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          <Icon className="h-4 w-4" />
          Set up {blocker.label}
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Setup order: Voice → Knowledge → Domain → Audience. This keeps Eve
          accurate — each step teaches the next.
        </p>
      </div>
    </div>
  );
}
