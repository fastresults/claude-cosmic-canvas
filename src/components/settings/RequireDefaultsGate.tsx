// Wraps content-creating surfaces. If Voice / Knowledge / Domain / Audience
// defaults aren't all set, sends the user to the first missing pillar rather
// than letting them start generating. Single CTA — no shortcuts.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, ArrowRight } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

type Props = { children: ReactNode; title?: string; description?: string };

const STEPS: { slot: DefaultSlot; label: string; to: string }[] = [
  { slot: "voice", label: "Voice", to: "/settings/voice" },
  { slot: "knowledge", label: "Knowledge", to: "/settings/knowledge" },
  { slot: "domain", label: "Domain", to: "/settings/domains" },
  { slot: "audience", label: "Audience", to: "/settings/audiences" },
];

export function RequireDefaultsGate({ children, title, description }: Props) {
  const d = useUserDefaults();
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

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
        <h2 className="font-display text-xl text-foreground">
          {title ?? "Finish your setup first"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ??
            "Eve needs the four pillars — Voice, Knowledge, Domain, Audience — before it can create anything on your behalf. One step at a time."}
        </p>

        <ol className="mt-4 flex flex-col gap-2">
          {STEPS.map((s, i) => {
            const isDone = done[s.slot];
            const isNext = s.slot === next.slot;
            return (
              <li
                key={s.slot}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
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
                <div className="flex-1 text-sm font-medium text-foreground">
                  {i + 1}. {s.label}
                </div>
              </li>
            );
          })}
        </ol>

        <Link
          to={next.to}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          Continue setup — {next.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {completed}/{STEPS.length} done
        </p>
      </div>
    </div>
  );
}
