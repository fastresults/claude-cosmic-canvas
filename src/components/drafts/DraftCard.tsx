import { Link, useNavigate } from "@tanstack/react-router";
import { ImageIcon, Sparkles } from "lucide-react";
import { ThumbPeek } from "@/components/primitives/ThumbPeek";

export type DraftListItem = {
  id: string;
  format_id: string;
  title: string | null;
  status: string;
  archived: boolean;
  quality_score: number | null;
  updated_at: string;
  platform?: string | null;
  scheduled_date?: string | null;
  media: Array<{ id: string; url: string; role: string | null }>;
  sections?: unknown;
};

export function DraftCard({ draft }: { draft: DraftListItem }) {
  const navigate = useNavigate();
  const cover = draft.media.find((m) => m.role === "cover") ?? draft.media[0];
  const snippet =
    Array.isArray(draft.sections) && draft.sections[0]
      ? String(
          (draft.sections[0] as { body?: string }).body ?? "",
        ).slice(0, 140)
      : "";
  const openDraft = () => navigate({ to: "/content/drafts/$id", params: { id: draft.id } });
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-3 hover:border-accent/60">
      {cover ? (
        <ThumbPeek
          src={cover.url}
          alt={draft.title ?? "Draft cover"}
          label={draft.title ?? "Draft cover"}
          confirmLabel="Open draft"
          onConfirm={openDraft}
          className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-background"
        >
          <img src={cover.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </ThumbPeek>
      ) : (
        <button
          type="button"
          onClick={openDraft}
          className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-background text-muted-foreground"
          aria-label="Open draft"
        >
          <ImageIcon className="h-6 w-6 opacity-40" />
        </button>
      )}
      <Link
        to="/content/drafts/$id"
        params={{ id: draft.id }}
        className="flex min-w-0 flex-1 flex-col gap-1"
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{draft.format_id}</span>
          {draft.platform && (
            <>
              <span>·</span>
              <span>{draft.platform}</span>
            </>
          )}
          {draft.status && draft.status !== "draft" && (
            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[9px] text-accent">
              {draft.status}
            </span>
          )}
        </div>
        <div className="line-clamp-1 text-sm text-foreground">{draft.title}</div>
        {snippet && <div className="line-clamp-2 text-xs text-muted-foreground">{snippet}</div>}
        <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
          {draft.quality_score != null && (
            <span className="flex items-center gap-0.5">
              <Sparkles className="h-3 w-3" />
              {Math.round(Number(draft.quality_score) * 100)}
            </span>
          )}
          <span>{new Date(draft.updated_at).toLocaleDateString()}</span>
          {!cover && <span className="ml-auto text-accent">+ Add image</span>}
        </div>
      </Link>
    </div>
  );
}
