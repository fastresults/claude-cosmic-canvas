import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Flag } from "lucide-react";
import { listFeatureFlags } from "@/lib/feature-flags/feature-flags.functions";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_authenticated/settings/flags")({
  component: FlagsPage,
});

type FlagRow = {
  key: string;
  enabled: boolean;
  globalEnabled: boolean;
  overridden: boolean;
  description: string | null;
};

function FlagsPage() {
  const listFn = useServerFn(listFeatureFlags);
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "flags"],
    queryFn: () => listFn() as Promise<FlagRow[]>,
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <Link
          to="/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Settings
        </Link>
        <h1 className="font-display text-3xl text-foreground">Feature flags</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Toggles the team uses to roll out risky changes gradually. Read-only for your account —
          contact support to opt in early.
        </p>
      </header>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-5 w-5" />}
          title="No flags defined"
          description="Feature flags will appear here as the team ships them."
        />
      ) : (
        <ul className="space-y-2">
          {data.map((f) => (
            <li
              key={f.key}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {f.key.replace(/[._]/g, " ")}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-pill border px-2 py-0.5 font-display text-[10px] tracking-wide ${
                      f.enabled
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                        : "border-border bg-surface-elev text-muted-foreground"
                    }`}
                  >
                    {f.enabled ? "On for you" : "Off"}
                  </span>
                  {f.overridden && (
                    <span className="inline-flex items-center rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.5 font-display text-[10px] tracking-wide text-accent">
                      Override
                    </span>
                  )}
                </div>
                {f.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{f.description}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
