import { useState } from "react";
import { X, Calendar, Loader2 } from "lucide-react";
import { useDraftMutations } from "@/hooks/useDrafts";

const PLATFORMS = ["linkedin", "twitter", "instagram", "email", "blog"];

export function SchedulePicker({
  open,
  onOpenChange,
  draftId,
  defaultPlatform = "linkedin",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draftId: string;
  defaultPlatform?: string;
}) {
  const { schedule } = useDraftMutations();
  const [platform, setPlatform] = useState(defaultPlatform);
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">Schedule</h2>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-muted-foreground hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground">
            Platform
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface p-2 text-sm text-foreground"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            When
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-surface p-2 text-sm text-foreground"
            />
          </label>
          <button
            disabled={schedule.isPending}
            onClick={async () => {
              await schedule.mutateAsync({
                draftId,
                scheduledAt: new Date(when).toISOString(),
                platform,
              });
              onOpenChange(false);
            }}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {schedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Schedule draft
          </button>
        </div>
      </div>
    </div>
  );
}
