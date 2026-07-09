import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Check, X } from "lucide-react";
import {
  deleteDirective,
  distillVoiceDirectives,
  getLearningSettings,
  listDirectives,
  updateDirective,
  updateLearningSettings,
} from "@/lib/voice/voice.functions";

export const Route = createFileRoute("/_authenticated/settings/voice/$id/learned")({
  component: LearnedPreferences,
});

function LearnedPreferences() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listDirectives);
  const updFn = useServerFn(updateDirective);
  const delFn = useServerFn(deleteDirective);
  const settingsFn = useServerFn(getLearningSettings);
  const settingsUpdFn = useServerFn(updateLearningSettings);
  const distillFn = useServerFn(distillVoiceDirectives);

  const { data: directives = [] } = useQuery({
    queryKey: ["voice-directives", id],
    queryFn: () => listFn({ data: { voiceProfileId: id } }),
  });
  const { data: settings } = useQuery({
    queryKey: ["voice-learning-settings"],
    queryFn: () => settingsFn(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["voice-directives", id] });

  const upd = useMutation({
    mutationFn: (v: { id: string; status: "active" | "dismissed" }) =>
      updFn({ data: v }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (i: string) => delFn({ data: { id: i } }),
    onSuccess: invalidate,
  });
  const distill = useMutation({
    mutationFn: () => distillFn({ data: { voiceProfileId: id } }),
    onSuccess: invalidate,
  });
  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => settingsUpdFn({ data: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-learning-settings"] }),
  });
  const setThreshold = useMutation({
    mutationFn: (auto_promote_threshold: number) =>
      settingsUpdFn({ data: { auto_promote_threshold } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-learning-settings"] }),
  });

  const suggested = directives.filter((d) => d.status === "suggested");
  const active = directives.filter((d) => d.status === "active");
  const dismissed = directives.filter((d) => d.status === "dismissed");

  return (
    <div className="mx-auto max-w-xl px-4 py-4 pb-24">
      <Link
        to="/settings/voice/$id"
        params={{ id }}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to voice
      </Link>
      <h1 className="mb-1 font-display text-2xl">Learned preferences</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Eve distills soft rules from your edits. Active rules are injected into
        every generation.
      </p>

      <section className="mb-4 rounded-lg border border-border bg-card p-3">
        <label className="flex items-center justify-between text-xs">
          <span>Learning enabled</span>
          <input
            type="checkbox"
            checked={settings?.enabled ?? true}
            onChange={(e) => setEnabled.mutate(e.target.checked)}
          />
        </label>
        <div className="mt-2">
          <div className="flex justify-between text-xs">
            <span>Auto-promote after</span>
            <span className="text-muted-foreground">
              {settings?.auto_promote_threshold ?? 3} signals
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={settings?.auto_promote_threshold ?? 3}
            onChange={(e) => setThreshold.mutate(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => distill.mutate()}
          disabled={distill.isPending}
          className="mt-2 rounded-md border border-accent/50 px-3 py-1.5 text-xs text-accent"
        >
          {distill.isPending ? "Distilling…" : "Distill signals now"}
        </button>
      </section>

      {suggested.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
            Suggested
          </h2>
          <ul className="space-y-2">
            {suggested.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {d.directive_type} · {d.evidence_count} evidence
                  </div>
                  <div>{d.directive_text}</div>
                </div>
                <button
                  onClick={() => upd.mutate({ id: d.id, status: "active" })}
                  aria-label="Approve"
                  className="rounded-full bg-accent/15 p-2 text-accent"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => upd.mutate({ id: d.id, status: "dismissed" })}
                  aria-label="Dismiss"
                  className="rounded-full bg-surface-elev p-2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4">
        <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active rules yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {active.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-xs"
              >
                <span className="text-[10px] uppercase text-muted-foreground">
                  {d.directive_type}
                </span>
                <span className="flex-1">{d.directive_text}</span>
                <button
                  onClick={() => upd.mutate({ id: d.id, status: "dismissed" })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dismissed.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Dismissed ({dismissed.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {dismissed.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-muted-foreground"
              >
                <span className="flex-1 line-through">{d.directive_text}</span>
                <button
                  onClick={() => upd.mutate({ id: d.id, status: "active" })}
                  className="text-accent"
                >
                  restore
                </button>
                <button
                  onClick={() => del.mutate(d.id)}
                  className="hover:text-destructive"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
