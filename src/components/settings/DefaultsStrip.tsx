// Persistent global strip of the three user defaults, rendered under the
// TopBar for every authenticated route. When any default is missing it
// switches to a bright warning so the user always sees setup is required.
// The leading "Profile" chip opens a one-click switcher that swaps all
// three defaults at once (see Settings → Profiles).
import { Link } from "@tanstack/react-router";
import { Mic, BookOpen, Compass, AlertCircle, Zap, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";
import { useDefaultProfiles } from "@/hooks/useDefaultProfiles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICONS: Record<DefaultSlot, typeof Mic> = {
  voice: Mic,
  knowledge: BookOpen,
  domain: Compass,
  audience: Users,
};

const LABELS: Record<DefaultSlot, string> = {
  voice: "Voice",
  knowledge: "Knowledge",
  domain: "Domain",
  audience: "Audience",
};

const TO: Record<DefaultSlot, string> = {
  voice: "/settings/voice",
  knowledge: "/settings/knowledge",
  domain: "/settings/domains",
  audience: "/settings/audiences",
};

export function DefaultsStrip() {
  const d = useUserDefaults();
  const { profiles, activeProfile, apply, isLoading: profilesLoading } =
    useDefaultProfiles();
  const [open, setOpen] = useState(false);

  if (d.loading) return null;

  const rows: {
    slot: DefaultSlot;
    value: string | null;
  }[] = [
    { slot: "voice", value: d.voice?.name ?? null },
    { slot: "knowledge", value: d.knowledge?.name ?? null },
    { slot: "domain", value: d.domain?.name ?? null },
    { slot: "audience", value: d.audience?.name ?? null },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 px-4 pb-2 pt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-display font-medium text-foreground hover:bg-accent/15"
            aria-label="Switch profile"
          >
            <Zap className="h-3 w-3" />
            <span className="max-w-[10rem] truncate">
              {activeProfile ? (
                <>
                  {activeProfile.emoji && <span className="mr-0.5">{activeProfile.emoji}</span>}
                  {activeProfile.name}
                </>
              ) : (
                "Profile"
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div className="px-2 py-1.5 text-[10px] font-display uppercase tracking-wider text-muted-foreground">
            One-click profiles
          </div>
          {profilesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              No profiles yet. Bundle a Voice + Knowledge + Domain into a one-click profile.
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      apply.mutate(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/10 ${
                      p.is_default ? "bg-accent/10 text-accent" : "text-foreground"
                    }`}
                  >
                    {p.emoji && <span>{p.emoji}</span>}
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.is_default && (
                      <span className="text-[9px] uppercase tracking-wide">Active</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              to="/settings/default-profiles"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              Manage profiles →
            </Link>
          </div>
        </PopoverContent>
      </Popover>

      <span className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
        Defaults
      </span>
      {rows.map(({ slot, value }) => {
        const Icon = ICONS[slot];
        const missing = !value;
        return (
          <Link
            key={slot}
            to={TO[slot]}
            className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-display transition-colors ${
              missing
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-accent/40 bg-accent/10 text-foreground font-medium hover:bg-accent/15"
            }`}
          >
            {missing ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Icon className="h-3 w-3 text-accent" />
            )}
            <span className="max-w-[10rem] truncate">
              {missing ? `Set ${LABELS[slot]}` : value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
