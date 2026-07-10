import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Archive, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspaces";
import { PhaseChip } from "@/components/workspaces/PhaseChip";
import { ProgressRing } from "@/components/workspaces/ProgressRing";
import {
  archiveWorkspace,
  deleteWorkspace,
  curateWorkspace,
  bulkShiftWorkspaceItems,
} from "@/lib/workspaces/workspaces.functions";
import { CREATE_FORMATS } from "@/config/createFormats";
import { PHASE_ORDER, PHASE_LABELS, type WorkspacePhase } from "@/lib/workspaces/phase";

export const Route = createFileRoute("/_authenticated/workspaces/$id")({
  component: WorkspaceDetail,
});

function WorkspaceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useWorkspace(id);
  const archiveFn = useServerFn(archiveWorkspace);
  const deleteFn = useServerFn(deleteWorkspace);
  const curateFn = useServerFn(curateWorkspace);
  const shiftFn = useServerFn(bulkShiftWorkspaceItems);
  const [curating, setCurating] = useState(false);
  const [curation, setCuration] = useState<Record<string, unknown> | null>(null);

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    const map = new Map<WorkspacePhase, typeof items>();
    PHASE_ORDER.forEach((p) => map.set(p, []));
    for (const it of items) {
      const p = (it.phase as WorkspacePhase) ?? "ongoing";
      map.get(p)!.push(it);
    }
    return PHASE_ORDER.map((p) => [p, map.get(p)!] as const);
  }, [data]);

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 pt-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    throw notFound();
  }

  const w = data.workspace;

  async function onArchive() {
    await archiveFn({ data: { id, archived: true } });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
    void navigate({ to: "/workspaces" });
  }
  async function onDelete() {
    if (!confirm("Delete this workspace? Drafts will unlink but stay in your Library.")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["workspaces"] });
    void navigate({ to: "/workspaces" });
  }
  async function onCurate() {
    setCurating(true);
    try {
      const res = (await curateFn({ data: { id } })) as Record<string, unknown>;
      setCuration(res);
    } finally {
      setCurating(false);
    }
  }
  async function onShiftWeek() {
    await shiftFn({ data: { workspace_id: id, shift_days: 7 } });
    qc.invalidateQueries({ queryKey: ["workspace", id] });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-32 pt-6">
      <Link to="/workspaces" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Workspaces
      </Link>

      <header className="flex items-start gap-3">
        <ProgressRing value={w.completed_items} max={Math.max(1, w.total_items)} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-2xl text-foreground">{w.title}</h1>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {w.moment_type}
            </span>
          </div>
          {w.target_date && (
            <p className="text-xs text-muted-foreground">
              Target: {new Date(w.target_date).toLocaleDateString()}
            </p>
          )}
          {w.description && <p className="mt-1 text-sm text-muted-foreground">{w.description}</p>}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCurate}
          disabled={curating}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-foreground disabled:opacity-40"
        >
          {curating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-accent" />}
          Curate
        </button>
        <button
          onClick={onShiftWeek}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Shift +1 week
        </button>
        <button
          onClick={onArchive}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      {curation && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3 text-xs text-foreground">
          <div className="mb-1 font-medium">Curation notes</div>
          <pre className="whitespace-pre-wrap font-sans text-muted-foreground">
            {JSON.stringify(curation, null, 2)}
          </pre>
        </div>
      )}

      {grouped.map(([phase, items]) =>
        items.length === 0 ? null : (
          <section key={phase}>
            <h2 className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              {PHASE_LABELS[phase]} <span className="text-[10px] text-muted-foreground/60">· {items.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((it) => {
                const fmt = CREATE_FORMATS.find((f) => f.id === it.content_type);
                return (
                  <li key={it.id}>
                    <Link
                      to="/create/$formatId"
                      params={{ formatId: it.content_type }}
                      search={{ wsId: id, wsItemId: it.id, seed: it.description ?? it.title }}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <PhaseChip phase={(it.phase as WorkspacePhase) ?? "ongoing"} />
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {fmt?.label ?? it.content_type}
                          </span>
                          <StatusPill status={it.status ?? "pending"} />
                        </div>
                        <div className="mt-1 truncate text-sm text-foreground">{it.title}</div>
                        {it.scheduled_date && (
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(it.scheduled_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={() =>
            navigate({
              to: "/create",
              search: { /* no wsId here — hub view */ } as never,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add item manually
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
      {status}
    </span>
  );
}
