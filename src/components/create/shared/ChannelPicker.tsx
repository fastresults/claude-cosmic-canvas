import { useMemo } from "react";
import { Check, Layers, Lock } from "lucide-react";
import { CHANNEL_SPECS } from "@/lib/workspaces/channelSpecs";
import type { Channel } from "@/lib/workspaces/strategy";
import { SOCIAL_CHANNELS } from "@/lib/create/channel-rules";

type Props = {
  value: Channel[];
  onChange: (next: Channel[]) => void;
  multi: boolean;
  onToggleMulti: () => void;
  locked?: boolean;
  lockedReason?: string;
  available?: Channel[]; // optional distribution filter
};

/**
 * Chip row for picking one (or many) social channels for the Social Post format.
 * Mobile-first, chip-based, keyboard-accessible.
 */
export function ChannelPicker({
  value,
  onChange,
  multi,
  onToggleMulti,
  locked,
  lockedReason,
  available,
}: Props) {
  const channels = useMemo(() => {
    const allowed = available && available.length > 0 ? available : SOCIAL_CHANNELS;
    return SOCIAL_CHANNELS.filter((c) => allowed.includes(c));
  }, [available]);

  function toggle(c: Channel) {
    if (locked) return;
    if (multi) {
      const has = value.includes(c);
      const next = has ? value.filter((v) => v !== c) : [...value, c];
      onChange(next);
    } else {
      onChange([c]);
    }
  }

  const primary = value[0];
  const hint = primary
    ? multi && value.length > 1
      ? `Post for ${value.length} channels`
      : `~${CHANNEL_SPECS[primary].ideal_chars[0]}–${CHANNEL_SPECS[primary].ideal_chars[1]} chars`
    : "Pick a channel";

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Channel
          {locked && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-surface-elev px-1.5 py-0.5 text-[10px] normal-case text-muted-foreground"
              title={lockedReason ?? "Set by workspace"}
            >
              <Lock className="h-3 w-3" /> {lockedReason ?? "Set by workspace"}
            </span>
          )}
        </div>
        {!locked && (
          <button
            type="button"
            onClick={onToggleMulti}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
              multi
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3 w-3" />
            {multi ? "Adapting for many" : "Adapt for more"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((c) => {
          const active = value.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              disabled={locked && !active}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-surface-elev text-foreground hover:border-primary/30"
              } ${locked && !active ? "opacity-40" : ""}`}
            >
              {active && <Check className="h-3 w-3" />}
              {CHANNEL_SPECS[c].label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
