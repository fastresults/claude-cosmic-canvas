import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Sparkles,
  X,
  Trash2,
  Archive,
  CheckSquare,
  Square,
  Loader2,
  ArrowDownWideNarrow,
  Clock,
  Star,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bulkDeleteDrafts,
  bulkSetStatus,
  listCampaigns,
  parseLibraryQuery,
  searchDrafts,
  type LibraryFilters,
  type LibrarySort,
} from "@/lib/library/library.functions";
import { useConfirm } from "@/components/confirm-dialog";
import { DraftDetailSheet } from "@/components/drafts/DraftDetailSheet";

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: (search: Record<string, unknown>) => ({
    scope:
      search.scope === "milestone" || search.scope === "general"
        ? (search.scope as "milestone" | "general")
        : ("general" as const),
    workspaceId:
      typeof search.workspaceId === "string" ? search.workspaceId : undefined,
  }),
  component: Library,
});

type Draft = {
  id: string;
  format: string;
  title: string | null;
  body: string;
  score: unknown;
  status: string;
  image_url: string | null;
  created_at: string;
  campaign_id: string | null;
  workspace_id: string | null;
  workspace_title: string | null;
};


function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (diff < hr) return `${Math.max(1, Math.round(diff / min))}m`;
  if (diff < day) return `${Math.round(diff / hr)}h`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function bucketFor(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 86_400_000) return "Today";
  if (diff < 7 * 86_400_000) return "This week";
  if (diff < 30 * 86_400_000) return "This month";
  return "Earlier";
}

function statusDot(status: string) {
  if (status === "posted") return "bg-success";
  if (status === "scheduled") return "bg-brain-blue";
  if (status === "archived") return "bg-brain-slate";
  return "bg-accent";
}

function Library() {
  const searchFn = useServerFn(searchDrafts);
  const parseFn = useServerFn(parseLibraryQuery);
  const campaignsFn = useServerFn(listCampaigns);
  const deleteFn = useServerFn(bulkDeleteDrafts);
  const statusFn = useServerFn(bulkSetStatus);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { scope, workspaceId } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [inputValue, setInputValue] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openDraftId, setOpenDraftId] = useState<string | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Reset collapse state when the scope tab changes.
  useEffect(() => {
    setExpandedGroups(workspaceId ? { __deepLink: true } : {});
  }, [scope, workspaceId]);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => campaignsFn(),
    staleTime: 60_000,
  });

  const query = useInfiniteQuery({
    queryKey: ["library-search", scope, workspaceId ?? null, q, filters, sort],
    queryFn: ({ pageParam }) =>
      searchFn({
        data: {
          q: q || undefined,
          filters,
          sort,
          scope,
          workspaceId: workspaceId ?? null,
          cursor: (pageParam as string | null) ?? null,
          limit: 30,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const drafts: Draft[] = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.items as Draft[]) ?? [];
    if (sort === "score") {
      return [...all].sort((a, b) => {
        const sa = (a.score as { total?: number })?.total ?? 0;
        const sb = (b.score as { total?: number })?.total ?? 0;
        return sb - sa;
      });
    }
    return all;
  }, [query.data, sort]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Draft[]>();
    for (const d of drafts) {
      let key: string;
      if (scope === "milestone" && sort !== "score") {
        // Group by milestone title in the Milestones tab (unless sorting by score).
        key = d.workspace_title ?? "Milestone";
      } else if (sort === "score") {
        const total = (d.score as { total?: number })?.total ?? 0;
        key = total >= 80 ? "Top" : total >= 50 ? "Strong" : total > 0 ? "Draft" : "Unscored";
      } else {
        key = bucketFor(d.created_at);
      }
      const arr = groups.get(key) ?? [];
      arr.push(d);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [drafts, sort, scope]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
        query.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleExpand(id: string) {
    if (selectionMode) {
      toggleSelect(id);
      return;
    }
    setOpenDraftId(id);
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectionMode(false);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["library-search"] });
    qc.invalidateQueries({ queryKey: ["drafts"] });
  }

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => deleteFn({ data: { ids } }),
    onSuccess: () => {
      clearSelection();
      invalidate();
    },
  });
  const bulkStatus = useMutation({
    mutationFn: (args: { ids: string[]; status: "archived" | "posted" | "scheduled" | "draft" }) =>
      statusFn({ data: args }),
    onSuccess: () => {
      clearSelection();
      invalidate();
    },
  });

  function submitSearch(text: string) {
    const t = text.trim();
    if (!t) {
      setQ("");
      setFilters({});
      return;
    }
    // Short queries → keyword; longer/NL → parse via Claude
    const looksNL = t.split(/\s+/).length >= 5 || /[?,]|\b(last|from|about|without|that|which|posted|scheduled|drafts?|linkedin|twitter|thread|essay)\b/i.test(t);
    if (!looksNL) {
      setQ(t);
      return;
    }
    setAiParsing(true);
    parseFn({ data: { utterance: t } })
      .then((res) => {
        setQ(res.q?.trim() ?? "");
        setFilters({
          formats: res.filters?.formats ?? undefined,
          statuses: res.filters?.statuses ?? undefined,
          dateFrom: res.filters?.dateFrom ?? undefined,
          dateTo: res.filters?.dateTo ?? undefined,
        });
      })
      .catch(() => {
        setQ(t);
      })
      .finally(() => setAiParsing(false));
  }

  const activeChips: Array<{ label: string; onRemove: () => void }> = [];
  if (q) activeChips.push({ label: `"${q}"`, onRemove: () => setQ("") });
  filters.formats?.forEach((f) =>
    activeChips.push({
      label: f,
      onRemove: () =>
        setFilters((p) => ({ ...p, formats: p.formats?.filter((x) => x !== f) })),
    }),
  );
  filters.statuses?.forEach((s) =>
    activeChips.push({
      label: s,
      onRemove: () =>
        setFilters((p) => ({ ...p, statuses: p.statuses?.filter((x) => x !== s) })),
    }),
  );
  if (filters.dateFrom || filters.dateTo) {
    activeChips.push({
      label: [
        filters.dateFrom && `from ${new Date(filters.dateFrom).toLocaleDateString()}`,
        filters.dateTo && `to ${new Date(filters.dateTo).toLocaleDateString()}`,
      ]
        .filter(Boolean)
        .join(" "),
      onRemove: () =>
        setFilters((p) => ({ ...p, dateFrom: undefined, dateTo: undefined })),
    });
  }
  if (filters.campaignId) {
    const c = campaigns.find((c) => c.id === filters.campaignId);
    activeChips.push({
      label: `campaign: ${c?.title ?? "…"}`,
      onRemove: () => setFilters((p) => ({ ...p, campaignId: undefined })),
    });
  }

  const totalLoaded = drafts.length;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-40">
      <header className="mb-3">
        <h1 className="font-display text-3xl text-foreground">Library</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {totalLoaded} loaded{query.hasNextPage ? "+" : ""} · every draft is a Brain node
        </p>
      </header>

      {/* Scope tabs: General library vs Milestones */}
      <div className="mb-3 inline-flex rounded-md border border-border bg-surface-elev p-0.5 text-xs">
        <button
          type="button"
          onClick={() =>
            navigate({ search: { scope: "general", workspaceId: undefined } })
          }
          className={cn(
            "rounded px-3 py-1 transition-colors",
            scope === "general"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          General
        </button>
        <button
          type="button"
          onClick={() =>
            navigate({ search: { scope: "milestone", workspaceId: undefined } })
          }
          className={cn(
            "rounded px-3 py-1 transition-colors",
            scope === "milestone"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Milestones
        </button>
      </div>

      {/* Command bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(inputValue);
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder='Ask Eve or search — "LinkedIn posts about pricing last week"'
          className="w-full rounded-full border border-input bg-surface-elev py-2.5 pl-10 pr-24 text-sm outline-none placeholder:text-muted-foreground focus:border-accent"
        />
        <button
          type="submit"
          disabled={aiParsing}
          className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground disabled:opacity-60"
        >
          {aiParsing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Parsing
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" /> Ask
            </>
          )}
        </button>
      </form>

      {/* Filter chips */}
      {activeChips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {activeChips.map((c, i) => (
            <button
              key={i}
              onClick={c.onRemove}
              className="group flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/20"
            >
              <span>{c.label}</span>
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          <button
            onClick={() => {
              setQ("");
              setFilters({});
              setInputValue("");
            }}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-3 mb-2 flex items-center justify-between border-b border-border pb-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <ArrowDownWideNarrow className="h-3 w-3" />
          <button
            onClick={() => setSort("recent")}
            className={cn("px-1.5 py-0.5 rounded", sort === "recent" && "bg-secondary text-foreground")}
          >
            Recent
          </button>
          <button
            onClick={() => setSort("oldest")}
            className={cn("px-1.5 py-0.5 rounded", sort === "oldest" && "bg-secondary text-foreground")}
          >
            Oldest
          </button>
          <button
            onClick={() => setSort("score")}
            className={cn("px-1.5 py-0.5 rounded flex items-center gap-1", sort === "score" && "bg-secondary text-foreground")}
          >
            <Star className="h-3 w-3" /> Score
          </button>
        </div>
        <button
          onClick={() => {
            setSelectionMode((s) => !s);
            if (selectionMode) clearSelection();
          }}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-0.5",
            selectionMode && "bg-secondary text-foreground",
          )}
        >
          {selectionMode ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          Select
        </button>
      </div>

      {/* Results */}
      {query.isLoading && (
        <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
        </div>
      )}
      {!query.isLoading && drafts.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">Nothing matches.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {q || activeChips.length > 0
              ? "Try broader terms, or clear filters."
              : "Hold the orb on Home to draft your first post."}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([group, items]) => (
          <section key={group}>
            <div className="sticky top-14 z-10 -mx-4 mb-1.5 flex items-center gap-2 bg-background/95 px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
              {sort === "score" ? <Star className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>{group}</span>
              <span className="text-border">·</span>
              <span>{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((d) => {
                const isSelected = selected.has(d.id);
                const score = (d.score as { total?: number; voiceMatch?: number }) ?? {};
                return (
                  <motion.article
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "cursor-pointer rounded-md border bg-card px-3 py-2 transition-colors",
                      isSelected
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-accent/40",
                    )}
                    onClick={() => toggleExpand(d.id)}
                  >
                    <div className="flex items-start gap-2">
                      {selectionMode && (
                        <div className="pt-0.5">
                          {isSelected ? (
                            <CheckSquare className="h-3.5 w-3.5 text-accent" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(d.status))} />
                          <span className="text-foreground/80">{d.format}</span>
                          <span className="text-border">·</span>
                          <span>{d.status}</span>
                          <span className="text-border">·</span>
                          <span>{relTime(d.created_at)}</span>
                          {score.total ? (
                            <>
                              <span className="text-border">·</span>
                              <span className="text-accent">{score.total}</span>
                            </>
                          ) : null}
                        </div>
                        {d.title ? (
                          <>
                            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{d.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {d.body.replace(/\s+/g, " ").slice(0, 140)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-0.5 truncate text-sm text-foreground/90">
                            {d.body.replace(/\s+/g, " ").slice(0, 140)}
                          </p>
                        )}

                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Infinite-scroll sentinel */}
      <div ref={sentinelRef} className="h-8" />
      {query.isFetchingNextPage && (
        <div className="flex justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )}

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectionMode && selected.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed inset-x-0 z-40 mx-auto flex max-w-2xl items-center justify-between gap-2 rounded-full border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
            style={{ bottom: "calc(10rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground">{selected.size} selected</span>
              <button
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  bulkStatus.mutate({ ids: [...selected], status: "archived" })
                }
                disabled={bulkStatus.isPending}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
              >
                <Archive className="h-3 w-3" /> Archive
              </button>
              <button
                onClick={async () => {
                  if (await confirm({ title: `Delete ${selected.size} draft(s)?`, destructive: true })) {
                    bulkDelete.mutate([...selected]);
                  }
                }}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {openDraftId && (
        <DraftDetailSheet draftId={openDraftId} onClose={() => setOpenDraftId(null)} />
      )}
    </div>
  );
}
