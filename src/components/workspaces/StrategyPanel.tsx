import { CHANNEL_LABELS, type Channel, type MilestoneStrategy } from "@/lib/workspaces/strategy";
import { PHASE_LABELS } from "@/lib/workspaces/phase";
import { AlertTriangle, Target } from "lucide-react";

type Props = { strategy: MilestoneStrategy | null };

export function StrategyPanel({ strategy }: Props) {
  if (!strategy) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-3 text-xs text-muted-foreground">
        No strategy yet — regenerate to get an AI-first release plan.
      </div>
    );
  }

  const phases = strategy.phases ?? {};
  const phaseOrder = ["tease", "announce", "amplify", "sustain"] as const;

  return (
    <div className="flex flex-col gap-3">
      {strategy.thesis && (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-accent">
            <Target className="h-3 w-3" /> Thesis
          </div>
          <p className="text-sm text-foreground">{strategy.thesis}</p>
          {strategy.target_outcomes?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {strategy.target_outcomes.map((o, i) => (
                <li
                  key={i}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {o}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {phaseOrder.map((p) => {
          const plan = phases[p];
          if (!plan) return null;
          return (
            <div key={p} className="rounded-2xl border border-border bg-surface p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {PHASE_LABELS[p]}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {plan.cadence_per_week}/wk · max {plan.max_items}
                </span>
              </div>
              {plan.primary_message && (
                <p className="text-xs text-foreground">{plan.primary_message}</p>
              )}
              {plan.channels?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {plan.channels.map((c) => (
                    <ChannelChip key={c} channel={c} />
                  ))}
                </div>
              )}
              {plan.format_mix?.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {plan.format_mix.slice(0, 4).map((m, i) => (
                    <li key={i}>
                      <span className="text-foreground">{m.count}×</span> {m.content_type}
                      {m.why ? ` — ${m.why}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {strategy.channel_strategy?.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Channel roles
          </div>
          <ul className="flex flex-col gap-1.5">
            {strategy.channel_strategy.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <ChannelChip channel={c.channel} />
                <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {c.role}
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {c.audience_fit}
                  <span className="ml-1 text-muted-foreground/60">· cap {c.cap_per_week}/wk</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {strategy.risks?.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-3 w-3" /> Risks
          </div>
          <ul className="space-y-0.5 text-xs text-foreground">
            {strategy.risks.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ChannelChip({ channel }: { channel: Channel | string }) {
  const label = CHANNEL_LABELS[channel as Channel] ?? channel;
  return (
    <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-foreground">
      {label}
    </span>
  );
}
