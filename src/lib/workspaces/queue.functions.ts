/**
 * Release queue — day-of approval and channel dispatch for milestone items.
 * Nothing auto-publishes. User must approve day-of; missing-date items are held.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const IdInput = z.object({ id: z.string().uuid() });

/** List queue items across all workspaces, grouped-friendly. */
export const listReleaseQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Reconcile first so missing-day items surface.
    await reconcileInternal(context.supabase, context.userId);

    const { data: rows, error } = await context.supabase
      .from("workspace_items")
      .select(
        "id, workspace_id, title, phase, content_type, channels, scheduled_date, release_status, approved_at, opportunity_workspaces!inner(id, title, moment_type, target_date, user_id)",
      )
      .eq("opportunity_workspaces.user_id", context.userId)
      .in("release_status", [
        "scheduled",
        "awaiting_approval",
        "held_missing_day",
        "approved",
        "released",
      ])
      .order("scheduled_date", { ascending: true, nullsFirst: true });
    if (error) throw error;
    return rows ?? [];
  });

/** Send an item into the release queue. */
export const sendItemToQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: item } = await context.supabase
      .from("workspace_items")
      .select("id, scheduled_date")
      .eq("id", data.id)
      .maybeSingle();
    if (!item) throw new Error("Item not found");
    const status = item.scheduled_date ? "scheduled" : "held_missing_day";
    const { error } = await context.supabase
      .from("workspace_items")
      .update({ release_status: status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, status };
  });

/** Approve + release now. Stub channel dispatch. */
export const approveAndRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("workspace_items")
      .update({
        release_status: "released",
        approved_at: now,
        approved_by: context.userId,
        release_notes: data.notes ?? null,
        status: "published",
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, released_at: now };
  });

/** Mark skipped — user opts out. */
export const skipReleaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_items")
      .update({ release_status: "skipped" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Reschedule a held/scheduled item. */
export const rescheduleReleaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), scheduled_date: z.string().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const status = data.scheduled_date ? "scheduled" : "held_missing_day";
    const { error } = await context.supabase
      .from("workspace_items")
      .update({ scheduled_date: data.scheduled_date, release_status: status })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true, status };
  });

/** Update per-item channels. */
export const updateItemChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), channels: z.array(z.string()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_items")
      .update({ channels: data.channels })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Reconcile — flip past-due unreleased to held_missing_day; scheduled-today → awaiting_approval. */
async function reconcileInternal(supabase: any, userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = today.toISOString();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("workspace_items")
    .update({ release_status: "awaiting_approval" })
    .eq("release_status", "scheduled")
    .lte("scheduled_date", tomorrow)
    .gte("scheduled_date", iso);
  await supabase
    .from("workspace_items")
    .update({ release_status: "held_missing_day" })
    .in("release_status", ["scheduled", "awaiting_approval"])
    .lt("scheduled_date", iso);
  void userId;
}
