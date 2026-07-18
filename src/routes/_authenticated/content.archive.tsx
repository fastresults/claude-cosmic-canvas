import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDrafts, useDraftMutations } from "@/hooks/useDrafts";
import { DraftCard, type DraftListItem } from "@/components/drafts/DraftCard";
import { RotateCcw, Archive as ArchiveIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export const Route = createFileRoute("/_authenticated/content/archive")({
  head: () => ({
    meta: [
      { title: "Archive — Eve" },
      { name: "description", content: "Archived drafts, images, and history." },
    ],
  }),
  component: ArchivePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Couldn't load archive: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-muted-foreground">Not found.</div>,
});

function ArchivePage() {
  const navigate = useNavigate();
  const drafts = useDrafts({ archived: true });
  const { restore } = useDraftMutations();
  const rows: DraftListItem[] = useMemo(
    () => (drafts.data?.pages.flat() ?? []) as DraftListItem[],
    [drafts.data],
  );
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-24 pt-6">
      <header>
        <button onClick={() => navigate({ to: "/content/drafts" })} className="text-xs text-muted-foreground hover:text-foreground">
          ← Drafts
        </button>
        <h1 className="mt-1 font-display text-3xl text-foreground">Archive</h1>
        <p className="text-sm text-muted-foreground">Restore or permanently review past work.</p>
      </header>
      {drafts.isPending ? (
        <ListSkeleton count={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ArchiveIcon className="h-5 w-5" />}
          title="Nothing archived"
          description="Restored drafts return to your library. Anything you archive later shows up here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((d) => (
            <div key={d.id} className="relative">
              <DraftCard draft={d} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  restore.mutate(d.id);
                }}
                className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-medium text-accent-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
