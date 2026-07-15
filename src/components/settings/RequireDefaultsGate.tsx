// Wraps content-creating surfaces. If Voice / Knowledge / Domain defaults are
// not all set, renders a friendly checklist that links to each settings page
// instead of letting the user start generating.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, ArrowRight, Mic, BookOpen, Compass } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

type Props = { children: ReactNode; title?: string; description?: string };

const ROWS: {
  slot: DefaultSlot;
  label: string;
  to: string;
  icon: typeof Mic;
  hint: string;
}[] = [
  { slot: "voice", label: "Voice & Style", to: "/settings/voice", icon: Mic, hint: "How Eve writes" },
  { slot: "knowledge", label: "Curriculum Vitae", to: "/settings/knowledge", icon: BookOpen, hint: "What Eve knows about you" },
  { slot: "domain", label: "Domain", to: "/settings/domains", icon: Compass, hint: "What you're expert in" },
];

export function RequireDefaultsGate({ children, title, description }: Props) {
  const d = useUserDefaults();
  if (d.loading) return null;
  if (d.ready) return <>{children}</>;

  const values: Record<DefaultSlot, string | null> = {
    voice: d.voice?.name ?? null,
    knowledge: d.knowledge?.name ?? null,
    domain: d.domain?.name ?? null,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <h2 className="font-display text-xl text-foreground">
          {title ?? "Set your defaults first"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ??
            "Eve needs a voice, a knowledge profile, and a domain before it can create anything on your behalf. Pick a default for each — you can change them any time."}
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {ROWS.map((r) => {
            const set = values[r.slot];
            const Icon = r.icon;
            return (
              <li key={r.slot}>
                <Link
                  to={r.to}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    set
                      ? "border-border bg-surface"
                      : "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full ${
                      set ? "bg-accent/20 text-accent" : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {set ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{r.label}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {set ? `Default: ${set}` : r.hint}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
