import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Target, ChevronRight } from "lucide-react";
import { CREATE_FORMATS, CATEGORY_LABELS, formatsByCategory, type CreateCategory } from "@/config/createFormats";
import { FormatCard } from "@/components/create/FormatCard";
import { useRecentCreateDrafts } from "@/hooks/useRecentCreateDrafts";
import { ActiveWorkspacePill } from "@/components/workspaces/ActiveWorkspacePill";
import { MilestonePrepSheet } from "@/components/workspaces/MilestonePrepSheet";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceContext } from "@/lib/workspaces/workspaceContextStore";
import { RequireDefaultsGate } from "@/components/settings/RequireDefaultsGate";

export const Route = createFileRoute("/_authenticated/create/")({
  head: () => ({
    meta: [
      { title: "Create — Eve" },
      { name: "description", content: "40+ AI-first content formats, one hub. Voice, mobile, one thumb." },
    ],
  }),
  component: CreateHub,
});

type Filter = CreateCategory | "all" | "milestones";

function CreateHub() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data: recent = [] } = useRecentCreateDrafts();
  const { data: workspaces = [] } = useWorkspaces(false);
  const activeWorkspaces = useMemo(
    () => workspaces.filter((w) => w.status === "active").slice(0, 8),
    [workspaces],
  );

  const workspaceId = useWorkspaceContext((s) => s.workspaceId);
  const workspaceItemId = useWorkspaceContext((s) => s.workspaceItemId);
  const setContext = useWorkspaceContext((s) => s.setContext);
  const activeTitle = workspaces.find((w) => w.id === workspaceId)?.title;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CREATE_FORMATS.filter((f) => {
      if (category !== "all" && category !== "milestones" && f.category !== category) return false;
      if (!q) return true;
      return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    if (category !== "all") return [[category as CreateCategory, filtered] as const];
    return formatsByCategory().map(([c, list]) => [c, list.filter((f) => filtered.includes(f))] as const);
  }, [filtered, category]);

  const showMilestones = category === "milestones";

  return (
    <RequireDefaultsGate>
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-24 pt-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-3xl text-foreground">Create</h1>
            <p className="text-sm text-muted-foreground">Say one sentence. Pick a format. Eve drafts the rest.</p>
          </div>
          <div className="flex items-center gap-2">
            {workspaceId && <ActiveWorkspacePill />}
            <Link
              to="/content/drafts"
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Drafts →
            </Link>
          </div>
        </div>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 40+ formats…"
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent/60"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex items-center gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>All</Chip>
          <Chip active={category === "milestones"} onClick={() => setCategory("milestones")}>
            <Target className="mr-1 inline h-3 w-3 -translate-y-[1px]" />
            Milestones
          </Chip>
          {(Object.keys(CATEGORY_LABELS) as CreateCategory[]).map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      {workspaceId && activeTitle && !showMilestones && (
        <p className="-mt-2 text-[11px] text-muted-foreground">
          Scoped to <span className="text-foreground">{activeTitle}</span> — new drafts save into this milestone.
        </p>
      )}

      {showMilestones ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Your milestones</h2>
            <Link to="/workspaces" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent/5 px-3 py-3 text-left text-sm text-foreground hover:bg-accent/10"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-accent">
              <Plus className="h-4 w-4" />
            </span>
            <span className="flex flex-col leading-tight">
              <span>New milestone</span>
              <span className="text-[10px] text-muted-foreground">Plan a full content arc</span>
            </span>
          </button>
          {activeWorkspaces.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground">
              No active milestones yet. Create one to scope drafts to a launch, keynote, or campaign.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeWorkspaces.map((w) => {
                const isActive = w.id === workspaceId;
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => setContext(isActive ? null : w.id, null)}
                      className={`flex w-full items-center justify-between gap-2 rounded-2xl border p-3 text-left text-sm transition-colors ${
                        isActive
                          ? "border-accent bg-accent/15 text-foreground"
                          : "border-border bg-surface text-foreground hover:border-accent/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Target className={`h-3 w-3 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {w.moment_type}
                          </span>
                        </div>
                        <div className="truncate">{w.title}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {w.completed_items ?? 0}/{w.total_items ?? 0}
                        </span>
                        {isActive ? <span className="text-accent">Active</span> : <ChevronRight className="h-3 w-3" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Recent drafts</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recent.slice(0, 8).map((d) => (
                  <Link
                    key={d.id}
                    to="/create/$formatId"
                    params={{ formatId: d.format_id }}
                    search={{ draftId: d.id }}
                    className="min-w-[180px] max-w-[220px] shrink-0 rounded-2xl border border-border bg-surface p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{d.format_id}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-foreground">{d.title}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {grouped.map(([c, list]) =>
            list.length === 0 ? null : (
              <section key={c}>
                <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{CATEGORY_LABELS[c]}</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {list.map((f) => (
                    <FormatCard key={f.id} format={f} wsId={workspaceId} wsItemId={workspaceItemId} />
                  ))}
                </div>
              </section>
            ),
          )}
        </>
      )}

      <MilestonePrepSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
    </RequireDefaultsGate>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active ? "border-accent bg-accent/15 text-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
