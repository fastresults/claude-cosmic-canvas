import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Mic } from "lucide-react";
import { EveSheet } from "@/components/primitives/EveSheet";
import {
  detectPlatform,
  micHelpFor,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/platform/mic-help";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRetry: () => void;
};

export function MicPermissionSheet({ open, onOpenChange, onRetry }: Props) {
  const detected = useMemo<Platform>(() => detectPlatform(), []);
  const [platform, setPlatform] = useState<Platform>(detected);
  const [showPicker, setShowPicker] = useState(false);
  const help = useMemo(() => micHelpFor(platform), [platform]);

  async function handleDeepLink() {
    if (!help.deepLink) return;
    if (help.deepLink.copy) {
      try {
        await navigator.clipboard.writeText(help.deepLink.href);
        toast.success("Address copied — paste it into a new tab.");
      } catch {
        toast.error("Couldn't copy — the address is: " + help.deepLink.href);
      }
      return;
    }
    window.location.href = help.deepLink.href;
  }

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title={help.title}>
      <div className="space-y-5 pb-6">
        {help.intro && <p className="text-sm text-muted-foreground">{help.intro}</p>}

        <ol className="space-y-3">
          {help.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground">
              <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>

        {help.deepLink && (
          <button
            type="button"
            onClick={handleDeepLink}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-elev px-4 py-3 text-sm text-foreground transition-colors hover:border-accent"
          >
            <span className="truncate">{help.deepLink.label}</span>
            {help.deepLink.copy ? (
              <Copy className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
          </button>
        )}

        {help.note && (
          <p className="rounded-md border border-border bg-surface-elev px-3 py-2 text-xs text-muted-foreground">
            {help.note}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            setTimeout(onRetry, 150);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground amber-glow"
        >
          <Mic className="h-4 w-4" />
          Try microphone again
        </button>

        <div className="text-center">
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Not your device?
            </button>
          ) : (
            <label className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              Choose your device
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="rounded-md border border-input bg-surface-elev px-3 py-2 text-sm text-foreground"
              >
                {PLATFORM_LABELS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </EveSheet>
  );
}
