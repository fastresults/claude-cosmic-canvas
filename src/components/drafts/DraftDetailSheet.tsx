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
    if (!next.length) {
      // Names are required — revert to the existing title, do not blank it out.
      setTitleDraft(current);
      setEditingTitle(false);
      return;
    }
    if (next !== current) {
      rename.mutate({ id: draft.id, title: next });
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

        <div className="flex flex-col gap-5 px-4 pb-32 pt-4">
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

        {/* Action dock — mobile-first: 5-col grid, icon + label stacked */}
        <div
          className="sticky bottom-0 border-t border-border bg-background/95 px-2 py-2 backdrop-blur"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          <div className="grid grid-cols-5 gap-1 sm:flex sm:items-center sm:gap-2 sm:px-2">
            <DockButton
              onClick={() => polish.mutate({ id: draft.id })}
              disabled={polish.isPending}
              icon={<RefreshCw className={`h-4 w-4 ${polish.isPending ? "animate-spin" : ""}`} />}
              label={polish.isPending ? "…" : "Polish"}
            />
            <DockButton
              onClick={() => setImgSheet({ open: true, role: "cover" })}
              icon={<ImagePlus className="h-4 w-4" />}
              label="Image"
            />
            <DockButton
              onClick={() => setSchedOpen(true)}
              icon={<Calendar className="h-4 w-4" />}
              label="Schedule"
            />
            <DockButton
              onClick={() => duplicate.mutate(draft.id)}
              icon={<Copy className="h-4 w-4" />}
              label="Copy"
            />
            <DockButton
              onClick={() => (draft.archived ? restore.mutate(draft.id) : archive.mutate(draft.id))}
              icon={<ArchiveIcon className="h-4 w-4" />}
              label={draft.archived ? "Restore" : "Archive"}
              tone="destructive"
            />
          </div>
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
            <ImagePlus className="h-4 w-4" /> Generate with AI or upload your own
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


function DockButton({
  onClick,
  disabled,
  icon,
  label,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "destructive";
}) {
  const isDestructive = tone === "destructive";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors disabled:opacity-50 sm:flex-row sm:gap-1.5 sm:rounded-full sm:border sm:px-3 sm:py-2 sm:text-xs " +
        (isDestructive
          ? "text-destructive hover:bg-destructive/10 sm:border-destructive/30 sm:bg-destructive/10"
          : "text-foreground hover:bg-surface sm:border-border sm:bg-surface")
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-3xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function formatSavedAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const min = 60_000, hr = 3_600_000, day = 86_400_000;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.round(diff / min)}m ago`;
  if (diff < day) return `${Math.round(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.round(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NextStepBanner({
  hasCover,
  status,
  onAddCover,
  onSchedule,
}: {
  hasCover: boolean;
  status: string;
  onAddCover: () => void;
  onSchedule: () => void;
}) {
  const scheduled = status === "scheduled" || status === "posted";
  const steps: Array<{ label: string; done: boolean; current: boolean }> = [
    { label: "Content drafted", done: true, current: false },
    { label: "Add a cover image", done: hasCover, current: !hasCover },
    { label: "Polish & schedule", done: scheduled, current: hasCover && !scheduled },
  ];
  const currentIdx = steps.findIndex((s) => s.current);
  const primaryLabel = !hasCover
    ? "Next: add a cover image so this post is ready to share."
    : !scheduled
      ? "Looks ready. Polish the copy or schedule when you're happy."
      : "Scheduled. You can still edit until it goes live.";

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
        <div className="flex-1 text-xs text-foreground">{primaryLabel}</div>
        {!hasCover && (
          <button
            onClick={onAddCover}
            className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground"
          >
            Add cover
          </button>
        )}
        {hasCover && !scheduled && (
          <button
            onClick={onSchedule}
            className="rounded-full bg-accent px-3 py-1 text-[11px] font-medium text-accent-foreground"
          >
            Schedule
          </button>
        )}
      </div>
      <ol className="mt-2.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span
              className={
                s.done
                  ? "flex h-4 w-4 items-center justify-center rounded-full bg-success/20 text-success"
                  : i === currentIdx
                    ? "flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground"
                    : "flex h-4 w-4 items-center justify-center rounded-full border border-border text-muted-foreground"
              }
            >
              {s.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <span className={i === currentIdx ? "text-foreground" : ""}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-border">—</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

