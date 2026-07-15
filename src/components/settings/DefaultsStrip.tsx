// Persistent global strip of the three user defaults, rendered under the
// TopBar for every authenticated route. When any default is missing it
// switches to a bright warning so the user always sees setup is required.
import { Link } from "@tanstack/react-router";
import { Mic, BookOpen, Compass, AlertCircle } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

const ICONS = {
  voice: Mic,
  knowledge: BookOpen,
  domain: Compass,
} as const;

const LABELS: Record<DefaultSlot, string> = {
  voice: "Voice",
  knowledge: "Knowledge",
  domain: "Domain",
};

const TO: Record<DefaultSlot, string> = {
  voice: "/settings/voice",
  knowledge: "/settings/knowledge",
  domain: "/settings/domains",
};

export function DefaultsStrip() {
  const d = useUserDefaults();
  if (d.loading) return null;

  const rows: {
    slot: DefaultSlot;
    value: string | null;
  }[] = [
    { slot: "voice", value: d.voice?.name ?? null },
    { slot: "knowledge", value: d.knowledge?.name ?? null },
    { slot: "domain", value: d.domain?.name ?? null },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 px-4 pb-2 pt-1">
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
                : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
            }`}
          >
            {missing ? <AlertCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            <span className="max-w-[10rem] truncate">
              {missing ? `Set ${LABELS[slot]}` : value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
