import { Link } from "@tanstack/react-router";
import { UserCircle2, FileText, ArrowRight } from "lucide-react";

type Side = "profile" | "preset";

/**
 * Shared header explainer that teaches Profile vs Preset in one glance.
 * The `current` side is full-color; the other is muted with a jump link.
 * Same shape and copy on both pages so users see the split anywhere they land.
 */
export function ProfileVsPresetCard({ current }: { current: Side }) {
  const profileActive = current === "profile";
  const presetActive = current === "preset";

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <SideCard
        icon={<UserCircle2 className="h-4 w-4" />}
        eyebrow="Profile"
        title="Who you are right now"
        bullets={["Voice · Knowledge · Domain · Audience", "One active at a time"]}
        active={profileActive}
        href="/settings/default-profiles"
        ariaLabel="Go to Profiles"
        tone="accent"
      />
      <SideCard
        icon={<FileText className="h-4 w-4" />}
        eyebrow="Preset"
        title="How this piece should feel"
        bullets={["Tone · Format · Length · Angle · References", "Pick per draft"]}
        active={presetActive}
        href="/settings/presets"
        ariaLabel="Go to Presets"
        tone="amber"
      />
    </div>
  );
}

function SideCard({
  icon,
  eyebrow,
  title,
  bullets,
  active,
  href,
  ariaLabel,
  tone,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  bullets: string[];
  active: boolean;
  href: string;
  ariaLabel: string;
  tone: "accent" | "amber";
}) {
  const activeRing =
    tone === "accent"
      ? "border-accent/40 bg-accent/5"
      : "border-amber-500/40 bg-amber-500/5";
  const activePill =
    tone === "accent"
      ? "bg-accent/15 text-accent"
      : "bg-amber-500/15 text-amber-500";
  const activeIcon =
    tone === "accent" ? "text-accent" : "text-amber-500";

  const body = (
    <div
      className={`h-full rounded-lg border p-3 transition-colors ${
        active
          ? activeRing
          : "border-border bg-surface-elev opacity-70 hover:opacity-100"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className={active ? activeIcon : "text-muted-foreground"}>
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </span>
        {active && (
          <span
            className={`ml-auto rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${activePill}`}
          >
            You're here
          </span>
        )}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <ul className="mt-1 space-y-0.5">
        {bullets.map((b) => (
          <li key={b} className="text-[11px] leading-snug text-muted-foreground">
            {b}
          </li>
        ))}
      </ul>
      {!active && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-foreground/80">
          Open {eyebrow}s
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );

  if (active) return body;
  return (
    <Link to={href} aria-label={ariaLabel} className="block h-full">
      {body}
    </Link>
  );
}
