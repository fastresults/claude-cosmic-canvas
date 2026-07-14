/**
 * Client-side orchestrator for a milestone: walks pending items and drafts
 * each via the existing generateCreateDraft server fn, then schedules the
 * result into the queue. Concurrency = 1 to be gentle on the gateway.
 *
 * Runs automatically once per workspace load when items are still pending.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { generateCreateDraft } from "@/lib/create/create.functions";
import {
  scheduleWorkspaceItemInQueue,
  getWorkspaceProgress,
} from "@/lib/workspaces/pipeline.functions";
import { normalizeCreateFormatId } from "@/config/createFormats";
import { CHANNEL_SPECS } from "@/lib/workspaces/channelSpecs";
import type { Channel } from "@/lib/workspaces/strategy";

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

function seedFor(item: Item): string {
  const primary = (item.channels?.[0] ?? "") as Channel;
  const spec = CHANNEL_SPECS[primary];
  const channelLine = spec
    ? `Write native to ${spec.label}. Structure: ${spec.structure}. Ideal length ${spec.ideal_chars[0]}–${spec.ideal_chars[1]} chars, hard max ${spec.max_chars}. Hook: ${spec.hook_style}. CTA: ${spec.cta_style}. Hashtags: ${spec.hashtag_policy}. Tone: ${spec.tone_hint}.`
    : "Write in the user's voice; no channel constraints supplied.";
  return [
    item.title,
    item.description ?? "",
    "",
    channelLine,
    "This piece is part of a coordinated milestone arc — refer to sibling pieces already in the workspace context without duplicating them. Elevate the user's authority and personal brand.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function useMilestoneAutoDraft(workspaceId: string, items: Item[]) {
  const qc = useQueryClient();
  const generate = useServerFn(generateCreateDraft);
  const schedule = useServerFn(scheduleWorkspaceItemInQueue);
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
    (async () => {
      let drafted = items.length - pending.length;
      const total = items.length;
      let scheduled = items.filter((i) => i.scheduled_date).length;
      setProgress({ drafted, total, scheduled });
      for (const it of pending) {
        try {
          const res = await generate({
            data: {
              formatId: normalizeCreateFormatId(it.content_type),
              seed: seedFor(it),
              workspaceId,
              workspaceItemId: it.id,
            },
          });
          if ((res as { fallback?: boolean }).fallback) {
            setFailed((p) => ({ ...p, [it.id]: (res as { message?: string }).message ?? "generation failed" }));
          } else {
            drafted += 1;
            if (it.scheduled_date) {
              try {
                await schedule({ data: { workspace_item_id: it.id } });
                scheduled += 1;
              } catch (err) {
                setFailed((p) => ({ ...p, [it.id]: err instanceof Error ? err.message : "schedule failed" }));
              }
            }
          }
        } catch (err) {
          setFailed((p) => ({ ...p, [it.id]: err instanceof Error ? err.message : "generation failed" }));
        }
        setProgress({ drafted, total, scheduled });
        qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      }
      // Final reconcile via server truth.
      try {
        const snap = await progressFn({ data: { id: workspaceId } });
        setProgress({ drafted: snap.drafted, total: snap.total, scheduled: snap.scheduled });
      } catch {
        /* ignore */
      }
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["release-queue"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, items.length]);

  return { running, progress, failed };
}
