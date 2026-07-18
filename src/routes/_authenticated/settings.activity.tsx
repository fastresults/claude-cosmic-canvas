import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Activity, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_authenticated/settings/activity")({
  component: ActivityPage,
});

type AuditRow = {
  id: string;
  action: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "generation.used_voice": "Draft generated",
  "generation.blocked_no_voice": "Draft blocked — no voice",
  "generation.failed": "Draft failed",
  "orchestrator.tool_call": "Assistant tool call",
  "orchestrator.completed": "Assistant response",
  "orchestrator.failed": "Assistant failed",
  "research.company.completed": "Company research completed",
  "research.company.failed": "Company research failed",
};

function labelFor(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusFor(action: string): "ok" | "warn" | "fail" {
  if (action.endsWith(".failed") || action.endsWith(".blocked_no_voice")) return "fail";
  if (action.endsWith(".blocked") || action.includes("warn")) return "warn";
  return "ok";
}

function formatDuration(ms: unknown): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function humanizeKey(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function MetaChip({ k, v }: { k: string; v: unknown }) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object") return null;
  let display: string;
  if (k.endsWith("_ms") && typeof v === "number") display = formatDuration(v) ?? String(v);
  else if (typeof v === "boolean") display = v ? "Yes" : "No";
  else display = String(v);
  if (display.length > 80) display = display.slice(0, 77) + "…";
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface-elev px-2 py-0.5 font-display text-[10px] tracking-wide text-muted-foreground">
      <span className="text-foreground/60">{humanizeKey(k)}</span>
      <span className="text-foreground">{display}</span>
    </span>
  );
}

function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings", "activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    staleTime: 15_000,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <Link
          to="/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Settings
        </Link>
        <h1 className="font-display text-3xl text-foreground">Activity</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Your recent generations, research runs, and assistant actions. Useful for support and audits.
        </p>
      </header>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="As you generate drafts and run research, an audit trail appears here."
        />
      ) : (
        <ul className="space-y-2">
          {data.map((row) => {
            const status = statusFor(row.action);
            const meta = row.meta ?? {};
            const traceId = typeof meta.trace_id === "string" ? meta.trace_id : null;
            const entries = Object.entries(meta).filter(([k]) => k !== "trace_id");
            const Icon = status === "fail" ? AlertTriangle : status === "warn" ? Clock : CheckCircle2;
            const tone =
              status === "fail"
                ? "text-destructive"
                : status === "warn"
                  ? "text-accent"
                  : "text-emerald-500";
            return (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{labelFor(row.action)}</span>
                      <span className="shrink-0 font-display text-[10px] tracking-wide text-muted-foreground">
                        {formatTime(row.created_at)}
                      </span>
                    </div>
                    {entries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {entries.map(([k, v]) => (
                          <MetaChip key={k} k={k} v={v} />
                        ))}
                      </div>
                    )}
                    {traceId && (
                      <div className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                        trace {traceId}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
