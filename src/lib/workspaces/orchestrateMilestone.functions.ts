// Orchestrated milestone runner. Fable 5 iterates the workspace's pending
// items, calling `draft_workspace_item` (and `schedule_workspace_item` when
// a date is set) via the tool loop. Non-streaming; the client polls
// getWorkspaceProgress for UI updates.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  workspaceId: z.string().uuid(),
  voiceOverrideId: z.string().uuid().optional(),
});

export const orchestrateMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load workspace + items to build a concrete plan for the agent.
    const { data: ws, error: wsErr } = await supabase
      .from("opportunity_workspaces")
      .select("id, title, moment_type, target_date")
      .eq("id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (wsErr) throw wsErr;
    if (!ws) throw new Error("Workspace not found");

    const { data: items, error: itErr } = await supabase
      .from("workspace_items")
      .select(
        "id, title, phase, channels, content_type, scheduled_date, content_generation_id, sort_order",
      )
      .eq("workspace_id", data.workspaceId)
      .order("sort_order", { ascending: true });
    if (itErr) throw itErr;
    const rows = items ?? [];
    const pending = rows.filter((r) => !r.content_generation_id);



    if (pending.length === 0 && rows.every((r) => !r.scheduled_date || r.content_generation_id)) {
      return { needsVoice: false as const, ranTools: 0, message: "Nothing to do." };
    }

    const { loadOrchestratorContext, composeOrchestratorSystem } = await import("@/lib/orchestrator/system.server");
    const loaded = await loadOrchestratorContext(supabase, userId, {
      voiceId: data.voiceOverrideId ?? null,
      intent: ws.title,
      includeMilestoneContext: true,
    });

    if (loaded.needsVoice) {
      await supabase.from("audit_log").insert({
        actor_user_id: userId,
        action: "generation.blocked_no_voice",
        meta: { surface: "milestone", workspace_id: data.workspaceId },
      });
      return { needsVoice: true as const };
    }

    const surfaceInstructions = [
      `You are running the milestone "${ws.title}" (${ws.moment_type}, target ${ws.target_date ?? "n/a"}).`,
      "",
      "PROCESS:",
      "1. For each item in `pending_items`, call `draft_workspace_item` with its id. Do NOT rewrite drafts that already exist.",
      "2. After drafting an item, if its `scheduled_date` is set, immediately call `schedule_workspace_item` with the same id.",
      "3. Work items in the order given. Do not call more than one tool per item unless a tool returns an error you can fix by retrying once.",
      "4. When every pending item is drafted (and, where applicable, scheduled), stop and reply with a single short sentence summarizing what shipped.",
      "",
      "Do not draft items that already have a `content_generation_id`. Do not schedule items without a `scheduled_date`.",
    ].join("\n");

    const planLines = rows.map((r) =>
      `- ${r.id} | phase=${r.phase} | type=${r.content_type} | channels=${(r.channels ?? []).join(",") || "-"} | scheduled=${r.scheduled_date ?? "-"} | drafted=${r.content_generation_id ? "yes" : "no"}`,
    );
    const prompt = [
      `WORKSPACE_ID: ${data.workspaceId}`,
      "",
      "All items:",
      ...planLines,
      "",
      `pending_items (${pending.length}): ${pending.map((p) => p.id).join(", ") || "(none)"}`,
      "",
      "Execute the process above using the milestone tools. Reply with one short sentence when done.",
    ].join("\n");

    const system = composeOrchestratorSystem({
      voice: loaded.voice,
      directives: loaded.directives,
      context: loaded.context,
      audience: loaded.audience,
      surface: "milestone",
      surfaceInstructions,
    });

    const { createOrchestratorProvider } = await import("@/lib/orchestrator/gateway.server");
    const { buildOrchestratorTools } = await import("@/lib/orchestrator/tools");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS, TOOL_STEP_LIMIT, modelCallOptions } = await import("@/lib/orchestrator/config");

    const gateway = createOrchestratorProvider();
    const tools = buildOrchestratorTools({ supabase, userId });

    const { runStreamed } = await import("@/lib/ai/stream.server");
    const result = await runStreamed({
      model: gateway(ORCHESTRATOR_MODEL),
      system,
      prompt,
      tools,
      stopWhen: TOOL_STEP_LIMIT,
      ...modelCallOptions(ORCHESTRATOR_MODEL, MAX_TOKENS),
    });

    const toolCalls: Array<{ tool: string; input: string }> = (result.steps ?? []).flatMap((s) =>
      (s.toolCalls ?? []).map((c) => ({
        tool: c.toolName,
        input: JSON.stringify(c.input ?? null),
      })),
    );

    await supabase.from("audit_log").insert({
      actor_user_id: userId,
      action: "generation.orchestrated",
      meta: {
        surface: "milestone",
        workspace_id: data.workspaceId,
        voice_id: loaded.voice.id,
        pending_at_start: pending.length,
        tool_calls: toolCalls.length,
        steps: result.steps?.length ?? 0,
      },
    });

    // Final progress reconcile.
    const { data: after } = await supabase
      .from("workspace_items")
      .select("id, content_generation_id, release_status")
      .eq("workspace_id", data.workspaceId);
    const afterRows = after ?? [];

    return {
      needsVoice: false as const,
      voiceId: loaded.voice.id,
      ranTools: toolCalls.length,
      text: result.text,
      progress: {
        total: afterRows.length,
        drafted: afterRows.filter((r) => !!r.content_generation_id).length,
        scheduled: afterRows.filter(
          (r) => r.release_status === "scheduled" || r.release_status === "awaiting_approval",
        ).length,
      },
    };
  });

