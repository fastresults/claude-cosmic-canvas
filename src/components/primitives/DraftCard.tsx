import { motion } from "framer-motion";
import { MoreHorizontal, Repeat, Scissors, Target, Sparkles, Calendar, Zap } from "lucide-react";
import { Pill } from "./Pill";
import { cn } from "@/lib/utils";

type DraftState = "idle" | "streaming" | "done" | "error" | "empty";

type DraftCardProps = {
  state?: DraftState;
  format: string;
  domain: string;
  body: string;
  score?: { total: number; voiceMatch: number };
  sourceCount?: number;
  imageUrl?: string;
  onSchedule?: () => void;
  onPublish?: () => void;
};

export function DraftCard({
  state = "done",
  format,
  domain,
  body,
  score,
  sourceCount = 0,
  imageUrl,
  onSchedule,
  onPublish,
}: DraftCardProps) {
  const isEmpty = state === "empty";
  const streaming = state === "streaming";

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
          <span>{domain}</span>
        </div>
        <button
          aria-label="More"
          className="rounded p-1 hover:bg-surface-elev"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </header>

      <div className="mb-3">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {body}
        </p>
      </div>

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="mb-3 h-32 w-full rounded-md object-cover"
        />
      )}

      {!isEmpty && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Pill size="sm" variant="ghost">
              <Repeat className="h-3 w-3" /> Regen
            </Pill>
            <Pill size="sm" variant="ghost">
              <Scissors className="h-3 w-3" /> Tighten
            </Pill>
            <Pill size="sm" variant="ghost">
              <Target className="h-3 w-3" /> Tone
            </Pill>
            <Pill size="sm" variant="ghost">
              <Sparkles className="h-3 w-3" /> Fit to
            </Pill>
          </div>

          <div className="mb-3 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
            <span>
              Score{" "}
              <span className="text-foreground">{score?.total ?? "—"}</span>
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
        </>
      )}
    </motion.article>
  );
}
