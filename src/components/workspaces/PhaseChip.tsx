import { PHASE_LABELS, type WorkspacePhase } from "@/lib/workspaces/phase";

/** Small phase chip using existing tokens. */
export function PhaseChip({ phase }: { phase: WorkspacePhase }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {PHASE_LABELS[phase]}
    </span>
  );
}
