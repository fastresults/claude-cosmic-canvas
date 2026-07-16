/**
 * Milestone pipeline — server functions the client orchestrator loop calls
 * per item after a milestone is created:
 *   1. draftMilestoneItem: routes to generateCreateDraft with a
 *      channel-native seed built from the item's brief + channel spec.
 *   2. scheduleWorkspaceItemInQueue: writes into scheduled_content so the
 *      milestone piece lives in the same scheduling queue as one-offs.
 *   3. listWorkspaceProgress: cheap progress snapshot for polling.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IdInput = z.object({ id: z.string().uuid() });

/** Schedule a workspace item — inserts scheduled_content row for its draft. */
export const scheduleWorkspaceItemInQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      workspace_item_id: z.string().uuid(),
      scheduled_at: z.string().datetime().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { runScheduleWorkspaceItem } = await import("./pipeline.server");
    const res = await runScheduleWorkspaceItem(data, {
      supabase: context.supabase,
      userId: context.userId,
    });
    if (!res.ok && res.reason === "not_found") throw new Error("Item not found");
    return res;
  });

/** Progress snapshot for a workspace — used by the auto-draft loop UI. */
export const getWorkspaceProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("workspace_items")
      .select("id, status, content_generation_id, release_status, scheduled_date, channels")
      .eq("workspace_id", data.id)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const rows = items ?? [];
    return {
      total: rows.length,
      drafted: rows.filter((r) => !!r.content_generation_id).length,
      scheduled: rows.filter((r) => r.release_status === "scheduled" || r.release_status === "awaiting_approval").length,
      pending: rows.filter((r) => !r.content_generation_id).map((r) => r.id),
    };
  });
