import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search, Plus, Archive as ArchiveIcon, FileText } from "lucide-react";
import { useDrafts } from "@/hooks/useDrafts";
import { DraftCard, type DraftListItem } from "@/components/drafts/DraftCard";
import { DraftDetailSheet } from "@/components/drafts/DraftDetailSheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";

const searchSchema = z.object({
  q: z.string().optional(),
  format: z.string().optional(),
  status: z.enum(["draft", "ready", "archived", "scheduled", "published"]).optional(),
  open: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/content/drafts/")({
  head: () => ({
    meta: [
      { title: "Drafts — Eve" },
      { name: "description", content: "Every draft, image, and schedule in one place." },
    ],
  }),
  validateSearch: searchSchema,
  component: DraftsHub,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Couldn't load drafts: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Not found.</div>,
});

function DraftsHub() {
  const search = useSearch({ from: "/_authenticated/content/drafts/" });
  const navigate = useNavigate();
  const [query, setQuery] = useState(search.q ?? "");

  const filter = useMemo(
    () => ({
      search: search.q || undefined,
      formatId: search.format,
      status: search.status,
      archived: false,
    }),
    [search.q, search.format, search.status],
  );

  const drafts = useDrafts(filter);
  const rows: DraftListItem[] = useMemo(
    () => (drafts.data?.pages.flat() ?? []) as DraftListItem[],
    [drafts.data],
  );

  const openId = search.open ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-24 pt-6">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-foreground">Drafts</h1>
          <p className="text-sm text-muted-foreground">Every unpublished piece and its images.</p>
        </div>
        <button
          onClick={() => navigate({ to: "/content/archive" })}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArchiveIcon className="h-3.5 w-3.5" /> Archive
        </button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() =>
            navigate({
              to: "/content/drafts",
              search: { ...search, q: query || undefined },
            })
          }
          placeholder="Search drafts…"
          className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-accent/60"
        />
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex items-center gap-2">
          <Chip
            active={!search.status}
            onClick={() => navigate({ to: "/content/drafts", search: { ...search, status: undefined } })}
          >
            All
          </Chip>
          {(["draft", "ready", "scheduled", "published"] as const).map((s) => (
            <Chip
              key={s}
              active={search.status === s}
              onClick={() =>
                navigate({
                  to: "/content/drafts",
                  search: { ...search, status: search.status === s ? undefined : s },
                })
              }
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>

      {drafts.isPending ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid gap-2 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          <div>No drafts yet.</div>
          <button
            onClick={() => navigate({ to: "/create" })}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Create your first
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate({ to: "/content/drafts", search: { ...search, open: d.id } })}
              className="text-left"
            >
              <DraftCard draft={d} />
            </button>
          ))}
          {drafts.hasNextPage && (
            <button
              onClick={() => drafts.fetchNextPage()}
              disabled={drafts.isFetchingNextPage}
              className="mx-auto mt-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground"
            >
              {drafts.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}

      {openId && (
        <DraftDetailSheet
          draftId={openId}
          onClose={() => navigate({ to: "/content/drafts", search: { ...search, open: undefined } })}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${
        active ? "border-accent bg-accent/15 text-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
