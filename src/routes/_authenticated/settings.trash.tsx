import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Trash2, RotateCcw, FileText, Image as ImageIcon } from "lucide-react";
import { listTrashedDrafts, restoreDraftFromTrash } from "@/lib/drafts/drafts.functions";
import { listTrashedMedia, restoreMediaAsset } from "@/lib/media/media.functions";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_authenticated/settings/trash")({
  component: TrashPage,
});

function daysLeft(deletedAt: string) {
  const purge = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purge - Date.now()) / (24 * 60 * 60 * 1000)));
}

function TrashPage() {
  const qc = useQueryClient();
  const listDraftsFn = useServerFn(listTrashedDrafts);
  const listMediaFn = useServerFn(listTrashedMedia);
  const restoreDraftFn = useServerFn(restoreDraftFromTrash);
  const restoreMediaFn = useServerFn(restoreMediaAsset);

  const drafts = useQuery({
    queryKey: ["trash", "drafts"],
    queryFn: () => listDraftsFn() as Promise<{ id: string; title: string; deleted_at: string }[]>,
  });
  const media = useQuery({
    queryKey: ["trash", "media"],
    queryFn: () => listMediaFn() as Promise<{ id: string; filename: string; deleted_at: string }[]>,
  });

  const restoreDraft = useMutation({
    mutationFn: (id: string) => restoreDraftFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
  });
  const restoreMedia = useMutation({
    mutationFn: (id: string) => restoreMediaFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
  });

  const isEmpty =
    !drafts.isLoading &&
    !media.isLoading &&
    (drafts.data?.length ?? 0) === 0 &&
    (media.data?.length ?? 0) === 0;

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
        <h1 className="font-display text-3xl text-foreground">Trash</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleted drafts and media are recoverable here for 30 days.
        </p>
      </header>

      {drafts.isLoading || media.isLoading ? (
        <ListSkeleton count={4} />
      ) : isEmpty ? (
        <EmptyState
          icon={<Trash2 className="h-5 w-5" />}
          title="Nothing in the trash"
          description="Anything you delete will appear here for 30 days before it's purged."
        />
      ) : (
        <div className="space-y-6">
          {(drafts.data?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xs tracking-wide text-muted-foreground">
                Drafts
              </h2>
              <ul className="space-y-2">
                {drafts.data!.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{d.title}</div>
                      <div className="font-display text-[10px] tracking-wide text-muted-foreground">
                        Purges in {daysLeft(d.deleted_at)} days
                      </div>
                    </div>
                    <button
                      onClick={() => restoreDraft.mutate(d.id)}
                      disabled={restoreDraft.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-elev px-2 py-1 text-xs text-foreground hover:bg-accent/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(media.data?.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xs tracking-wide text-muted-foreground">
                Media
              </h2>
              <ul className="space-y-2">
                {media.data!.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{m.filename}</div>
                      <div className="font-display text-[10px] tracking-wide text-muted-foreground">
                        Purges in {daysLeft(m.deleted_at)} days
                      </div>
                    </div>
                    <button
                      onClick={() => restoreMedia.mutate(m.id)}
                      disabled={restoreMedia.isPending}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-elev px-2 py-1 text-xs text-foreground hover:bg-accent/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
