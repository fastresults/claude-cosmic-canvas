import { X } from "lucide-react";

type Props = {
  status: "recording" | "transcribing" | "error";
  elapsed?: number;
  level?: number;
  errorMessage?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  compact?: boolean;
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Shared pill shown while a mic recording is active. Pulsing dot, live level
 * bar, mm:ss timer, cancel button. Uses design tokens only.
 */
export function RecordingIndicator({
  status,
  elapsed = 0,
  level = 0,
  errorMessage,
  onCancel,
  onRetry,
  compact = false,
}: Props) {
  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive animate-fade-in"
      >
        <span className="truncate">{errorMessage ?? "Recording failed"}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-destructive/20 px-2 py-0.5 text-[11px] font-medium hover:bg-destructive/30"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const pct = Math.round(Math.max(0.04, level) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 pl-2.5 pr-1 py-1 text-xs text-foreground animate-fade-in ${compact ? "" : "min-w-[10rem]"}`}
    >
      {status === "recording" ? (
        <>
          <span className="relative grid h-2.5 w-2.5 place-items-center flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-70" />
            <span className="relative h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="tabular-nums text-[11px] text-muted-foreground w-8">
            {fmt(elapsed)}
          </span>
          <span className="relative h-1.5 flex-1 min-w-[3rem] overflow-hidden rounded-full bg-muted/50">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-75"
              style={{ width: `${pct}%` }}
            />
          </span>
        </>
      ) : (
        <>
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-accent streaming-shimmer" />
          <span className="text-[11px] text-muted-foreground">Transcribing…</span>
        </>
      )}
      {onCancel && status === "recording" && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel recording"
          className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-elev hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
