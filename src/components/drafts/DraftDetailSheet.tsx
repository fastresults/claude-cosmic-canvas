import { X, Sparkles, Archive as ArchiveIcon, Copy, Calendar, ImagePlus, RefreshCw, Trash2, Pencil, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDraft, useDraftMutations } from "@/hooks/useDrafts";
import { useDraftImages, useRemoveDraftImage } from "@/hooks/useDraftImages";
import { ImageAssociationSheet } from "./ImageAssociationSheet";
import { SchedulePicker } from "./SchedulePicker";
import { ThumbPeek } from "@/components/primitives/ThumbPeek";

type Role = "cover" | "social" | "inline";

export function DraftDetailSheet({
  draftId,
  onClose,
}: {
  draftId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useDraft(draftId);
  const images = useDraftImages(draftId);
  const removeImg = useRemoveDraftImage(draftId);
  const { archive, restore, duplicate, polish, rename } = useDraftMutations();
  const [imgSheet, setImgSheet] = useState<{ open: boolean; role: Role }>({ open: false, role: "cover" });
  const [schedOpen, setSchedOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);


  if (isLoading) {
    return (
      <SheetShell onClose={onClose}>
        <div className="flex items-center justify-between p-4">
          <div className="text-sm text-muted-foreground">Loading draft…</div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
      </SheetShell>
    );
  }

  if (!data) {
    return (
      <SheetShell onClose={onClose}>
        <div className="flex items-start justify-between gap-4 p-6">
          <p className="text-sm text-muted-foreground">Draft not found.</p>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
      </SheetShell>
    );
  }

  const draft = data.draft as Record<string, unknown> & {
    id: string;
    title: string | null;
    sections: unknown;
    format_id: string;
    archived: boolean;
    status: string;
    platform: string | null;
    updated_at?: string | null;
  };
  const media = (images.data ?? []).map((m) => ({ ...m, role: (m.role ?? "cover") as Role }));
  const cover = media.filter((m) => m.role === "cover");
  const social = media.filter((m) => m.role === "social");
  const inline = media.filter((m) => m.role === "inline");
  const hasCover = cover.length > 0;
  const savedLabel = formatSavedAgo(draft.updated_at);

  function commitTitle() {
    const next = titleDraft.trim();
    const current = draft.title ?? "";
    if (next !== current) {
      rename.mutate({ id: draft.id, title: next.length ? next : null });
    }
    setEditingTitle(false);
  }
  function beginEditTitle() {
    setTitleDraft(draft.title ?? "");
    setEditingTitle(true);
  }

  return (
    <>
      <SheetShell onClose={onClose}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {draft.format_id} {draft.platform ? `· ${draft.platform}` : ""}
            </div>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
                  else if (e.key === "Escape") { setEditingTitle(false); }
                }}
                maxLength={120}
                placeholder="Name this draft (optional)"
                className="w-full bg-transparent font-display text-lg text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            ) : (
              <button
                type="button"
                onClick={beginEditTitle}
                className="group flex w-full items-center gap-1.5 text-left"
                aria-label="Rename draft"
              >
                <span
                  className={
                    draft.title
                      ? "truncate font-display text-lg text-foreground"
                      : "truncate font-display text-lg text-muted-foreground/70"
                  }
                >
                  {draft.title ?? "Name this draft (optional)"}
                </span>
                <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="capitalize text-foreground/70">{draft.status}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-success" />
                Saved{savedLabel ? ` ${savedLabel}` : ""}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-5 px-4 pb-24 pt-4">
          {/* Progress: what's next */}
          <NextStepBanner
            hasCover={hasCover}
            status={draft.status}
            onAddCover={() => setImgSheet({ open: true, role: "cover" })}
            onSchedule={() => setSchedOpen(true)}
          />



          {/* Image tray by role */}
          <ImageRow
            label="Cover"
            role="cover"
            items={cover}
            onAdd={() => setImgSheet({ open: true, role: "cover" })}
            onRemove={(id) => removeImg.mutate(id)}
          />
          <ImageRow
            label="Social"
            role="social"
            items={social}
            onAdd={() => setImgSheet({ open: true, role: "social" })}
            onRemove={(id) => removeImg.mutate(id)}
          />
          <ImageRow
            label="Inline"
            role="inline"
            items={inline}
            onAdd={() => setImgSheet({ open: true, role: "inline" })}
            onRemove={(id) => removeImg.mutate(id)}
          />


          {/* Body preview */}
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Content</h2>
            <div className="flex flex-col gap-3 text-sm text-foreground">
              {Array.isArray(draft.sections) &&
                (draft.sections as Array<{ heading?: string | null; body?: string }>).map((s, i) => (
                  <div key={i}>
                    {s.heading && <div className="mb-1 font-medium">{s.heading}</div>}
                    <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{s.body}</div>
                  </div>
                ))}
            </div>
          </section>

          {data.history.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted-foreground">
              <span className="text-foreground">{data.history.length}</span> previous version{data.history.length === 1 ? "" : "s"} saved.
            </section>
          )}
        </div>

        {/* Action dock */}
        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => polish.mutate({ id: draft.id })}
            disabled={polish.isPending}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {polish.isPending ? "Polishing…" : "Polish"}
          </button>
          <button
            onClick={() => setImgSheet({ open: true, role: "cover" })}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Image
          </button>
          <button
            onClick={() => setSchedOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground"
          >
            <Calendar className="h-3.5 w-3.5" /> Schedule
          </button>
          <button
            onClick={() => duplicate.mutate(draft.id)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => (draft.archived ? restore.mutate(draft.id) : archive.mutate(draft.id))}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <ArchiveIcon className="h-3.5 w-3.5" /> {draft.archived ? "Restore" : "Archive"}
          </button>
        </div>
      </SheetShell>

      {imgSheet.open && (
        <ImageAssociationSheet
          open={imgSheet.open}
          onOpenChange={(v) => setImgSheet((s) => ({ ...s, open: v }))}
          draftId={draft.id}
          role={imgSheet.role}
        />
      )}
      {schedOpen && (
        <SchedulePicker
          open={schedOpen}
          onOpenChange={setSchedOpen}
          draftId={draft.id}
          defaultPlatform={draft.platform ?? "linkedin"}
        />
      )}
    </>
  );
}

function ImageRow({
  label,
  role,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  role: Role;
  items: Array<{ id: string; url: string; role: Role }>;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">{label}</h2>
        <button onClick={onAdd} className="text-[11px] text-accent">
          + Add {role}
        </button>
      </div>
      {items.length === 0 ? (
        <button
          onClick={onAdd}
          className="grid h-24 w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-surface text-xs text-muted-foreground hover:border-accent/60"
        >
          <div className="flex items-center gap-1.5">
            <ImagePlus className="h-4 w-4" /> Generate or upload
          </div>
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((m) => (
            <div key={m.id} className="group relative h-24 w-32 shrink-0">
              <ThumbPeek
                src={m.url}
                alt={`${role} image`}
                className="h-full w-full overflow-hidden rounded-xl bg-surface"
              >
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              </ThumbPeek>
              <button
                onClick={() => onRemove(m.id)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-3xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
