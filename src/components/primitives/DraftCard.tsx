import { motion } from "framer-motion";
import {
  MoreHorizontal,
  Repeat,
  Scissors,
  Target,
  Sparkles,
  Calendar,
  Zap,
  Save,
  X,
} from "lucide-react";
import { Pill } from "./Pill";
import { cn } from "@/lib/utils";

type DraftState = "idle" | "streaming" | "done" | "error" | "empty";
type DraftMode = "working" | "saved";
export type RefineKind = "regen" | "tighten" | "tone";

type DraftCardProps = {
  state?: DraftState;
  mode?: DraftMode;
  format: string;
  domain: string;
  body: string;
  score?: { total: number; voiceMatch: number };
  sourceCount?: number;
  imageUrl?: string;
  busy?: boolean;
  onSchedule?: () => void;
  onPublish?: () => void;
  onRefine?: (kind: RefineKind) => void;
  onSave?: () => void;
  onDiscard?: () => void;
};

export function DraftCard({
  state = "done",
  mode = "saved",
  format,
  domain,
  body,
  score,
  sourceCount = 0,
  imageUrl,
  busy = false,
  onSchedule,
  onPublish,
  onRefine,
  onSave,
  onDiscard,
}: DraftCardProps) {
  const isEmpty = state === "empty";
  const streaming = state === "streaming" || busy;
  const working = mode === "working";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-4",
        streaming && "streaming-shimmer",
        isEmpty && "opacity-70",
      )}
    >
      <header className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="text-accent">▲</span>
          <span>{format}</span>
          <span className="text-border">·</span>
          <span>{working ? "Working draft" : domain}</span>
        </div>
        <button aria-label="More" className="rounded p-1 hover:bg-surface-elev">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      <div className="mb-3">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {body}
        </p>
      </div>

      {imageUrl && (
        <ThumbPeek src={imageUrl} alt="" className="mb-3 block h-32 w-full overflow-hidden rounded-md">
          <img src={imageUrl} alt="" className="h-32 w-full object-cover" />
        </ThumbPeek>
      )}

      {!isEmpty && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy || !onRefine}
              onClick={() => onRefine?.("regen")}
              className="disabled:opacity-50"
            >
              <Pill size="sm" variant="ghost">
                <Repeat className="h-3 w-3" /> Regen
              </Pill>
            </button>
            <button
              type="button"
              disabled={busy || !onRefine}
              onClick={() => onRefine?.("tighten")}
              className="disabled:opacity-50"
            >
              <Pill size="sm" variant="ghost">
                <Scissors className="h-3 w-3" /> Tighten
              </Pill>
            </button>
            <button
              type="button"
              disabled={busy || !onRefine}
              onClick={() => onRefine?.("tone")}
              className="disabled:opacity-50"
            >
              <Pill size="sm" variant="ghost">
                <Target className="h-3 w-3" /> Tone
              </Pill>
            </button>
            {!working && (
              <Pill size="sm" variant="ghost">
                <Sparkles className="h-3 w-3" /> Fit to
              </Pill>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
            <span>
              Score <span className="text-foreground">{score?.total ?? "—"}</span>
              <span className="px-1.5 text-border">·</span>
              Voice{" "}
              <span className="text-foreground">
                {score?.voiceMatch?.toFixed(2) ?? "—"}
              </span>
            </span>
            <button className="flex items-center gap-1 text-brain-teal hover:text-foreground">
              <span aria-hidden>🧠</span>
              {sourceCount} sources
            </button>
          </div>

          {working ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDiscard}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-elev py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Discard
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save to drafts
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onSchedule}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-elev py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </button>
              <button
                onClick={onPublish}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Zap className="h-3.5 w-3.5" />
                Post now
              </button>
            </div>
          )}
        </>
      )}
    </motion.article>
  );
}
