/**
 * Kicks off the Fable 5 orchestrator for a milestone workspace once per
 * load. The orchestrator decides tool order (draft, then schedule) via the
 * tool loop; this hook polls `getWorkspaceProgress` so the ring/UI reflects
 * server-truth as items land.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { orchestrateMilestone } from "@/lib/workspaces/orchestrateMilestone.functions";
import { getWorkspaceProgress } from "@/lib/workspaces/pipeline.functions";

type Item = {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  channels: string[];
  scheduled_date: string | null;
  content_generation_id?: string | null;
  status?: string;
};

export function useMilestoneAutoDraft(workspaceId: string, items: Item[]) {
  const qc = useQueryClient();
  const run = useServerFn(orchestrateMilestone);
  const progressFn = useServerFn(getWorkspaceProgress);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ drafted: number; total: number; scheduled: number } | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const pending = items.filter((i) => !i.content_generation_id);
    if (pending.length === 0) return;
    started.current = true;
    setRunning(true);
    setProgress({
      drafted: items.length - pending.length,
      total: items.length,
      scheduled: items.filter((i) => i.scheduled_date).length,
    });

    let cancelled = false;
    const poll = setInterval(async () => {
      try {
        const snap = await progressFn({ data: { id: workspaceId } });
        if (cancelled) return;
        setProgress({ drafted: snap.drafted, total: snap.total, scheduled: snap.scheduled });
        qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      } catch {
        /* ignore transient */
      }
    }, 3000);

    (async () => {
      try {
        const res = await run({ data: { workspaceId } });
        if (cancelled) return;
        if ("needsVoice" in res && res.needsVoice) {
          setFailed({ __voice__: "No active voice — set one to enable drafting." });
        } else if ("progress" in res && res.progress) {
          setProgress(res.progress);
        }
      } catch (err) {
        if (!cancelled) {
          setFailed({ __run__: err instanceof Error ? err.message : "orchestrator failed" });
        }
      } finally {
        clearInterval(poll);
        if (!cancelled) {
          try {
            const snap = await progressFn({ data: { id: workspaceId } });
            setProgress({ drafted: snap.drafted, total: snap.total, scheduled: snap.scheduled });
          } catch {
            /* ignore */
          }
          setRunning(false);
          qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
          qc.invalidateQueries({ queryKey: ["release-queue"] });
        }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, items.length]);

  return { running, progress, failed };
}
