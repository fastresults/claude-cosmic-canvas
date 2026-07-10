/** Workspace arc phases + heuristic for picking a phase from a T±n offset. */

export type WorkspacePhase = "tease" | "announce" | "amplify" | "sustain" | "ongoing";

export const PHASE_ORDER: WorkspacePhase[] = ["tease", "announce", "amplify", "sustain", "ongoing"];

export const PHASE_LABELS: Record<WorkspacePhase, string> = {
  tease: "Tease",
  announce: "Announce",
  amplify: "Amplify",
  sustain: "Sustain",
  ongoing: "Ongoing",
};

/** Days-from-target → phase. Tease T-14..T-4 / Announce T-1..T+1 / Amplify T+2..T+10 / Sustain T+11..T+30. */
export function phaseForOffset(daysFromTarget: number): WorkspacePhase {
  if (daysFromTarget <= -4) return "tease";
  if (daysFromTarget >= -1 && daysFromTarget <= 1) return "announce";
  if (daysFromTarget >= 2 && daysFromTarget <= 10) return "amplify";
  if (daysFromTarget >= 11 && daysFromTarget <= 30) return "sustain";
  return "ongoing";
}

export function daysFromTarget(scheduled: Date | string | null, target: Date | string | null): number | null {
  if (!scheduled || !target) return null;
  const s = new Date(scheduled).getTime();
  const t = new Date(target).getTime();
  return Math.round((s - t) / (1000 * 60 * 60 * 24));
}

export function formatTOffset(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "T";
  return days > 0 ? `T+${days}` : `T${days}`;
}
