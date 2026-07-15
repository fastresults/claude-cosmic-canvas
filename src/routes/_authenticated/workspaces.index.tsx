import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ProgressRing } from "@/components/workspaces/ProgressRing";
import { MilestonePrepSheet } from "@/components/workspaces/MilestonePrepSheet";
import { useUserDefaults } from "@/hooks/useUserDefaults";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workspaces/")({
  head: () => ({
    meta: [
      { title: "Workspaces — Eve" },
      { name: "description", content: "Plan and execute milestone content arcs." },
    ],
  }),
  component: WorkspacesList,
});

function WorkspacesList() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-32 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Milestone-scoped content arcs. Plan, generate, ship, archive.
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && workspaces.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <Target className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-2 font-display text-lg text-foreground">No milestones yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Say what you're preparing for. Eve plans the arc.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New milestone
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {workspaces.map((w) => {
          const days = daysUntil(w.target_date);
          return (
            <Link
              key={w.id}
              to="/workspaces/$id"
              params={{ id: w.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/60 active:scale-[0.99]"
            >
              <ProgressRing value={w.completed_items} max={Math.max(1, w.total_items)} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-base text-foreground">{w.title}</h3>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {w.moment_type}
                  </span>
                </div>
                {w.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">{w.description}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {days === null
                    ? "No target date"
                    : days === 0
                      ? "Target: today"
                      : days > 0
                        ? `${days} days to go`
                        : `${-days} days after target`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="New milestone"
        className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </button>

      <MilestonePrepSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

function daysUntil(target: string | null): number | null {
  if (!target) return null;
  const t = new Date(target).getTime();
  const now = Date.now();
  return Math.round((t - now) / (1000 * 60 * 60 * 24));
}
