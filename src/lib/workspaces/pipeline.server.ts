// Server-only core for scheduling a workspace item into the release queue.
// Shared between the client-facing RPC and orchestrator tools.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ScheduleResult =
  | { ok: true; scheduled_at: string; platform: string | null }
  | { ok: false; reason: "no_draft" | "no_date" | "not_found" };

export async function runScheduleWorkspaceItem(
  input: { workspace_item_id: string; scheduled_at?: string },
  ctx: { supabase: SupabaseClient<any>; userId: string },
): Promise<ScheduleResult> {
  const { supabase, userId } = ctx;

  const { data: item, error: iErr } = await supabase
    .from("workspace_items")
    .select("id, scheduled_date, channels, content_generation_id, workspace_id")
    .eq("id", input.workspace_item_id)
    .maybeSingle();
  if (iErr) throw iErr;
  if (!item) return { ok: false, reason: "not_found" };
  if (!item.content_generation_id) return { ok: false, reason: "no_draft" };

  const when = input.scheduled_at ?? item.scheduled_date ?? null;
  if (!when) return { ok: false, reason: "no_date" };

  const slot = /T\d{2}:\d{2}/.test(when)
    ? when
    : new Date(`${when.slice(0, 10)}T09:00:00`).toISOString();
  const platform = (item.channels?.[0] as string | undefined) ?? null;

  const { data: existing } = await supabase
    .from("scheduled_content")
    .select("id")
    .eq("draft_id", item.content_generation_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("scheduled_content")
      .update({ scheduled_at: slot, platform, status: "scheduled" })
      .eq("id", existing.id);
  } else {
    const { error: sErr } = await supabase.from("scheduled_content").insert({
      user_id: userId,
      draft_id: item.content_generation_id,
      scheduled_at: slot,
      platform,
      status: "scheduled",
    });
    if (sErr) throw sErr;
  }

  await supabase
    .from("workspace_items")
    .update({ scheduled_date: slot, release_status: "scheduled" })
    .eq("id", input.workspace_item_id);

  await supabase
    .from("create_drafts")
    .update({ scheduled_date: slot, platform, status: "ready" })
    .eq("id", item.content_generation_id);

  return { ok: true, scheduled_at: slot, platform };
}
