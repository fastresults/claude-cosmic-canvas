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
    const { data: item, error: iErr } = await context.supabase
      .from("workspace_items")
      .select("id, scheduled_date, channels, content_generation_id, workspace_id")
      .eq("id", data.workspace_item_id)
      .maybeSingle();
    if (iErr) throw iErr;
    if (!item) throw new Error("Item not found");
    if (!item.content_generation_id) {
      return { ok: false, reason: "no_draft" as const };
    }
    const when = data.scheduled_at ?? item.scheduled_date ?? null;
    if (!when) return { ok: false, reason: "no_date" as const };

    // Slot at 9am local if only date given.
    const slot = /T\d{2}:\d{2}/.test(when) ? when : new Date(`${when.slice(0, 10)}T09:00:00`).toISOString();
    const platform = (item.channels?.[0] as string | undefined) ?? null;

    // Upsert-ish: if a scheduled_content row already exists for this draft, update it.
    const { data: existing } = await context.supabase
      .from("scheduled_content")
      .select("id")
      .eq("draft_id", item.content_generation_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      await context.supabase
        .from("scheduled_content")
        .update({ scheduled_at: slot, platform, status: "scheduled" })
        .eq("id", existing.id);
    } else {
      const { error: sErr } = await context.supabase.from("scheduled_content").insert({
        user_id: context.userId,
        draft_id: item.content_generation_id,
        scheduled_at: slot,
        platform,
        status: "scheduled",
      });
      if (sErr) throw sErr;
    }

    await context.supabase
      .from("workspace_items")
      .update({ scheduled_date: slot, release_status: "scheduled" })
      .eq("id", data.workspace_item_id);

    await context.supabase
      .from("create_drafts")
      .update({ scheduled_date: slot, platform, status: "ready" })
      .eq("id", item.content_generation_id);

    return { ok: true, scheduled_at: slot, platform } as const;
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
