import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, AlertCircle, SkipForward, Loader2 } from "lucide-react";
import { ListSkeleton } from "@/components/ui/list-skeleton";


import { useMemo, useState } from "react";
import {
  listReleaseQueue,
  approveAndRelease,
  skipReleaseItem,
  rescheduleReleaseItem,
} from "@/lib/workspaces/queue.functions";
import { PhaseChip } from "@/components/workspaces/PhaseChip";
import { ChannelChip } from "@/components/workspaces/StrategyPanel";
import { RELEASE_STATUS_LABELS, type ReleaseStatus } from "@/lib/workspaces/strategy";
import type { WorkspacePhase } from "@/lib/workspaces/phase";

export const Route = createFileRoute("/_authenticated/queue")({
  component: QueuePage,
  head: () => ({
    meta: [{ title: "Release queue · Eve" }],
  }),
});

type Row = {
  id: string;
  workspace_id: string;
  title: string;
  phase: string;
  content_type: string;
  channels: string[] | null;
  scheduled_date: string | null;
  release_status: ReleaseStatus;
  approved_at: string | null;
  opportunity_workspaces: { id: string; title: string; moment_type: string } | null;
};

function QueuePage() {
  const fn = useServerFn(listReleaseQueue);
  const { data, isLoading } = useQuery({
    queryKey: ["release-queue"],
    queryFn: () => fn({ data: undefined as never }),
    staleTime: 15_000,
  });

  const rows = (data ?? []) as unknown as Row[];

  const groups = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const g = {
      today: [] as Row[],
      held: [] as Row[],
      upcoming: [] as Row[],
      released: [] as Row[],
    };
    for (const r of rows) {
      if (r.release_status === "released") g.released.push(r);
      else if (r.release_status === "held_missing_day" || !r.scheduled_date) g.held.push(r);
      else if (r.release_status === "awaiting_approval") g.today.push(r);
      else {
        const d = new Date(r.scheduled_date);
        if (d < in7) g.upcoming.push(r);
      }
    }
    return g;
  }, [rows]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-32 pt-6">
      <header>
        <h1 className="font-display text-2xl text-foreground">Release queue</h1>
        <p className="text-xs text-muted-foreground">
          Day-of approval required for every item. Missing dates stay held.
        </p>
      </header>

      {isLoading && <ListSkeleton count={4} />}


      <Section
        title="Today · needs approval"
        icon={<AlertCircle className="h-3.5 w-3.5 text-accent" />}
        rows={groups.today}
        emptyLabel="Nothing due today."
      />
      <Section
        title="Held · missing date"
        icon={<Clock className="h-3.5 w-3.5 text-amber-500" />}
        rows={groups.held}
        emptyLabel="No held items."
      />
      <Section
        title="Upcoming · next 7 days"
        icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
        rows={groups.upcoming}
        emptyLabel="Nothing scheduled this week."
      />
      <Section
        title="Released"
        icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        rows={groups.released.slice(0, 20)}
        emptyLabel="No releases yet."
        muted
      />
    </div>
  );
}

function Section({
  title,
  icon,
  rows,
  emptyLabel,
  muted,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Row[];
  emptyLabel: string;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {title}
        <span className="text-[10px] text-muted-foreground/60">· {rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">{emptyLabel}</p>
      ) : (
        <ul className={`flex flex-col gap-2 ${muted ? "opacity-70" : ""}`}>
          {rows.map((r) => (
            <QueueRow key={r.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRow({ row }: { row: Row }) {
  const qc = useQueryClient();
  const approveFn = useServerFn(approveAndRelease);
  const skipFn = useServerFn(skipReleaseItem);
  const rescheduleFn = useServerFn(rescheduleReleaseItem);
  const [busy, setBusy] = useState<"approve" | "skip" | "reschedule" | null>(null);
  const [dateInput, setDateInput] = useState<string>(
    row.scheduled_date ? row.scheduled_date.slice(0, 10) : "",
  );

  async function approve() {
    setBusy("approve");
    try {
      await approveFn({ data: { id: row.id } });
      qc.invalidateQueries({ queryKey: ["release-queue"] });
    } finally {
      setBusy(null);
    }
  }
  async function skip() {
    setBusy("skip");
    try {
      await skipFn({ data: { id: row.id } });
      qc.invalidateQueries({ queryKey: ["release-queue"] });
    } finally {
      setBusy(null);
    }
  }
  async function reschedule(v: string) {
    setBusy("reschedule");
    try {
      await rescheduleFn({
        data: { id: row.id, scheduled_date: v ? new Date(v).toISOString() : null },
      });
      qc.invalidateQueries({ queryKey: ["release-queue"] });
    } finally {
      setBusy(null);
    }
  }

  const canApprove =
    row.release_status === "awaiting_approval" || row.release_status === "approved";

  return (
    <li className="rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <PhaseChip phase={(row.phase as WorkspacePhase) ?? "ongoing"} />
        <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          {RELEASE_STATUS_LABELS[row.release_status] ?? row.release_status}
        </span>
        {(row.channels ?? []).map((c) => (
          <ChannelChip key={c} channel={c} />
        ))}
        {row.opportunity_workspaces && (
          <Link
            to="/workspaces/$id"
            params={{ id: row.opportunity_workspaces.id }}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
          >
            {row.opportunity_workspaces.title}
          </Link>
        )}
      </div>
      <div className="mt-1 text-sm text-foreground">{row.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== (row.scheduled_date?.slice(0, 10) ?? "")) {
              void reschedule(e.target.value);
            }
          }}
          className="rounded-full border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-accent/60"
        />
        {row.release_status !== "released" && (
          <>
            <button
              onClick={approve}
              disabled={!canApprove || busy !== null}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] text-primary-foreground disabled:opacity-40"
            >
              {busy === "approve" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Approve & release
            </button>
            <button
              onClick={skip}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <SkipForward className="h-3 w-3" /> Skip
            </button>
          </>
        )}
      </div>
      {!canApprove && row.release_status !== "released" && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          {row.release_status === "held_missing_day"
            ? "Set a date to move this out of hold."
            : "Waiting for release day."}
        </p>
      )}
    </li>
  );
}
