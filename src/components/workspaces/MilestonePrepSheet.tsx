import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, Trash2 } from "lucide-react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Textarea } from "@/components/ui/textarea";
import { PhaseChip } from "@/components/workspaces/PhaseChip";
import { StrategyPanel, ChannelChip } from "@/components/workspaces/StrategyPanel";
import {
  runWorkspaceInterview,
  planWorkspaceArc,
  createWorkspace,
} from "@/lib/workspaces/workspaces.functions";
import { CREATE_FORMATS, normalizeCreateFormatId } from "@/config/createFormats";
import type { WorkspacePhase } from "@/lib/workspaces/phase";
import type { MilestoneStrategy } from "@/lib/workspaces/strategy";
import { useUserDefaults } from "@/hooks/useUserDefaults";
import { RequireDefaultsGate } from "@/components/settings/RequireDefaultsGate";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; prefill?: string };

type MomentType = "launch" | "keynote" | "funding" | "seasonal" | "pr_event" | "custom";

type Draft = {
  content_type: string;
  title: string;
  description: string;
  phase: WorkspacePhase;
  priority: "low" | "normal" | "high";
  sort_order: number;
  scheduled_date: string | null;
  channels: string[];
};

const MOMENT_OPTIONS: { id: MomentType; label: string }[] = [
  { id: "launch", label: "Launch" },
  { id: "keynote", label: "Keynote" },
  { id: "funding", label: "Funding" },
  { id: "pr_event", label: "PR event" },
  { id: "seasonal", label: "Seasonal" },
  { id: "custom", label: "Custom" },
];

export function MilestonePrepSheet({ open, onOpenChange, prefill }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const interviewFn = useServerFn(runWorkspaceInterview);
  const planFn = useServerFn(planWorkspaceArc);
  const createFn = useServerFn(createWorkspace);

  const [step, setStep] = useState<"intake" | "preview" | "confirming">("intake");
  const [intent, setIntent] = useState(prefill ?? "");
  const [momentType, setMomentType] = useState<MomentType>("launch");
  const [targetDate, setTargetDate] = useState<string>("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown>>({});
  const [strategy, setStrategy] = useState<MilestoneStrategy | null>(null);
  const [items, setItems] = useState<Draft[]>([]);

  function resetAll() {
    setStep("intake");
    setIntent("");
    setMomentType("launch");
    setTargetDate("");
    setTitle("");
    setBusy(false);
    setError(null);
    setAnalysis({});
    setStrategy(null);
    setItems([]);
  }

  async function runPlan() {
    if (!intent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const interview = await interviewFn({
        data: { moment_type: momentType, target_date: targetDate || undefined, intent: intent.trim() },
      });
      setAnalysis(interview.ai_analysis);
      const plan = await planFn({
        data: {
          moment_type: momentType,
          target_date: targetDate || undefined,
          intent: intent.trim(),
          ai_analysis: interview.ai_analysis,
        },
      });
      const planItems = (plan as { items: Array<Record<string, unknown>> }).items ?? [];
      const planStrategy = (plan as { strategy: MilestoneStrategy | null }).strategy ?? null;
      const planned: Draft[] = planItems.map((it, idx) => ({
        content_type: String(it.content_type),
        title: String(it.title),
        description: String(it.description ?? ""),
        phase: (it.phase as WorkspacePhase) ?? "ongoing",
        priority: (it.priority as "low" | "normal" | "high") ?? "normal",
        sort_order: idx,
        scheduled_date: (it.scheduled_date as string | null) ?? null,
        channels: Array.isArray(it.channels) ? (it.channels as string[]) : [],
      }));
      setItems(planned);
      setStrategy(planStrategy);
      if (!title) setTitle(intent.trim().slice(0, 80));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (items.length === 0 || !title.trim()) return;
    setStep("confirming");
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          title: title.trim(),
          moment_type: momentType,
          target_date: targetDate || undefined,
          ai_analysis: analysis,
          strategy: (strategy as unknown as Record<string, unknown>) ?? undefined,
          items,
        },
      });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      onOpenChange(false);
      resetAll();
      void navigate({ to: "/workspaces/$id", params: { id: res.workspaceId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
      setStep("preview");
    } finally {
      setBusy(false);
    }
  }

  function updateItem(idx: number, patch: Partial<Draft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="New milestone">
      {step === "intake" && (
        <div className="flex flex-col gap-4 pb-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">What are you preparing for?</label>
            <Textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={4}
              placeholder="We're launching X on March 12 — a new pricing tier for teams."
              className="mt-1 rounded-2xl border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent/60"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Moment</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {MOMENT_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMomentType(m.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    momentType === m.id
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Target date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-accent/60"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={runPlan}
            disabled={busy || !intent.trim()}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {busy ? "Planning strategy…" : "Generate strategy"}
          </button>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-3 pb-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Milestone title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-accent/60"
            />
          </div>

          <StrategyPanel strategy={strategy} />

          {Array.isArray((analysis as { _missing_context?: string[] })._missing_context) &&
            ((analysis as { _missing_context: string[] })._missing_context.length > 0) && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-500">
                Missing signals: {(analysis as { _missing_context: string[] })._missing_context.join(", ")}. Add these in Settings for stronger personalization on your next milestone.
              </div>
            )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {items.length} pieces · tap to edit
            </p>
            <button
              onClick={runPlan}
              disabled={busy}
              className="text-[11px] text-accent hover:underline disabled:opacity-40"
            >
              Regenerate
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((it, idx) => {
              const fmt = CREATE_FORMATS.find((f) => f.id === normalizeCreateFormatId(it.content_type));
              return (
                <li
                  key={idx}
                  className="rounded-2xl border border-border bg-surface p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PhaseChip phase={it.phase} />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {fmt?.label ?? it.content_type}
                        </span>
                        {it.channels.map((c) => (
                          <ChannelChip key={c} channel={c} />
                        ))}
                      </div>
                      <input
                        value={it.title}
                        onChange={(e) => updateItem(idx, { title: e.target.value })}
                        className="mt-1 w-full bg-transparent text-sm text-foreground outline-none"
                      />
                      {it.description && (
                        <p className="text-xs text-muted-foreground">{it.description}</p>
                      )}
                      {it.scheduled_date ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(it.scheduled_date).toLocaleDateString()}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-amber-500">Held · no date</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      aria-label="Remove"
                      className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setStep("intake")}
              className="flex-1 rounded-full border border-border bg-surface px-3 py-3 text-sm text-foreground"
            >
              Back
            </button>
            <button
              onClick={confirm}
              disabled={busy || items.length === 0 || !title.trim()}
              className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create & auto-draft
            </button>
          </div>
        </div>
      )}

      {step === "confirming" && (
        <div className="grid place-items-center py-10 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="mt-3">Creating milestone…</span>
        </div>
      )}
    </EveSheet>
  );
}
