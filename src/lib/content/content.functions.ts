// Content pipeline server functions.
// Generation returns text only (no DB write). Saving to Library and
// refinements are separate calls, so a single working draft can be refined
// in place and only persists when the user explicitly saves.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DraftInput = z.object({
  prompt: z.string().min(1),
  format: z.string().default("post"),
});

const RefineInput = z.object({
  currentBody: z.string().min(1),
  instruction: z.string().min(1),
  format: z.string().default("post"),
});

const SaveInput = z.object({
  body: z.string().min(1),
  format: z.string().default("post"),
  prompt: z.string().optional(),
  campaignId: z.string().uuid().optional(),
});

async function loadPersonaContext(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("persona_active_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  let personaName: string | null = null;
  let voiceDirectives: unknown = null;
  let voiceSignals: unknown = null;
  const personaId: string | null = profile?.persona_active_id ?? null;

  if (personaId) {
    const [{ data: persona }, { data: voice }] = await Promise.all([
      supabase.from("personas").select("name").eq("id", personaId).maybeSingle(),
      supabase
        .from("voice_profiles")
        .select("directives, signals")
        .eq("persona_id", personaId)
        .maybeSingle(),
    ]);
    personaName = persona?.name ?? null;
    voiceDirectives = voice?.directives ?? null;
    voiceSignals = voice?.signals ?? null;
  }

  return {
    personaId,
    personaName,
    voiceDirectives,
    voiceSignals,
    displayName: profile?.display_name ?? null,
  };
}

function buildSystem(args: {
  personaName: string | null;
  displayName: string | null;
  voiceDirectives: unknown;
  voiceSignals: unknown;
  format: string;
}) {
  return [
    "You are Eve, an on-brand ghostwriter.",
    args.personaName
      ? `Writing as: ${args.personaName}.`
      : `Writing as: ${args.displayName ?? "the user"}.`,
    args.voiceDirectives ? `Voice directives: ${JSON.stringify(args.voiceDirectives)}` : "",
    args.voiceSignals ? `Voice signals: ${JSON.stringify(args.voiceSignals)}` : "",
    `Return ONLY the final ${args.format} body. No preamble, no commentary, no markdown fences.`,
    "Match the user's cadence. Concrete over abstract. Never fabricate facts.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Generate a fresh draft body from a prompt. Does NOT persist. */
export const contentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");

    const ctx = await loadPersonaContext(supabase, userId);
    const system = buildSystem({ ...ctx, format: data.format });

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt: data.prompt,
      system,
    });

    return {
      body: result.text.trim(),
      format: data.format,
      prompt: data.prompt,
      usage: result.usage,
    };
  });

/** Refine an existing working draft in place. Does NOT persist. */
export const refineDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RefineInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");

    const ctx = await loadPersonaContext(supabase, userId);
    const system = buildSystem({ ...ctx, format: data.format });

    const prompt = [
      `Here is the current ${data.format}:`,
      "---",
      data.currentBody,
      "---",
      `Rewrite it per this instruction: ${data.instruction}`,
      "Return only the revised body.",
    ].join("\n");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt,
      system,
    });

    return {
      body: result.text.trim(),
      format: data.format,
      usage: result.usage,
    };
  });

/** Persist a finalized working draft to the Library with provenance edges. */
export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ORCHESTRATOR_MODEL } = await import("@/lib/orchestrator/config");
    const { writeEdgesServer } = await import("@/lib/ai/provenance.server");
    const { readWorkspaceContext } = await import(
      "@/lib/workspaces/workspaceContextStore"
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("persona_active_id")
      .eq("user_id", userId)
      .maybeSingle();
    const personaId: string | null = profile?.persona_active_id ?? null;

    // Derive a non-blank title (create_drafts.title is NOT NULL): first line
    // of the body, trimmed to a short summary.
    const firstLine = data.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "Quick post";
    const derivedTitle =
      firstLine.length > 80 ? firstLine.slice(0, 77).trimEnd() + "…" : firstLine;

    const wsCtx = readWorkspaceContext();

    const { data: row, error: draftErr } = await supabase
      .from("create_drafts")
      .insert({
        user_id: userId,
        format_id: data.format,
        title: derivedTitle,
        sections: [{ heading: null, body: data.body }],
        status: "draft",
        campaign_id: data.campaignId ?? null,
        workspace_id: wsCtx.workspace_id ?? null,
        workspace_item_id: wsCtx.workspace_item_id ?? null,
      })
      .select("id, format_id, sections, status, created_at")
      .single();

    if (draftErr || !row) {
      throw new Error(`Failed to save draft: ${draftErr?.message ?? "unknown"}`);
    }

    const edges: Parameters<typeof writeEdgesServer>[2] = [
      {
        srcType: "you",
        srcId: userId,
        edgeKind: "GENERATED_BY_TOOL",
        dstType: "draft",
        dstId: row.id,
        meta: {
          tool: "claude",
          model: ORCHESTRATOR_MODEL,
          prompt: data.prompt?.slice(0, 500) ?? null,
          format: data.format,
        },
      },
    ];
    if (personaId) {
      edges.push({
        srcType: "persona",
        srcId: personaId,
        edgeKind: "SPEAKS_IN",
        dstType: "draft",
        dstId: row.id,
      });
    }
    await writeEdgesServer(supabase, userId, edges);

    // Legacy return shape so working-draft.tsx callers keep working.
    return {
      draft: {
        id: row.id,
        format: row.format_id,
        body: data.body,
        score: { total: 0, voiceMatch: 0 },
        status: row.status,
        created_at: row.created_at,
      },
    };
  });

export const listRecentDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("create_drafts")
      .select("id, format_id, title, sections, quality_score, status, created_at, campaign_id")
      .eq("user_id", context.userId)
      .eq("status", "draft")
      .eq("archived", false)
      // Recent Drafts strip = general library only; milestone items live under their workspace.
      .is("workspace_id", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []).map((r) => {
      const sections = Array.isArray(r.sections) ? r.sections : [];
      const first = (sections[0] ?? {}) as { body?: string };
      return {
        id: r.id,
        format: r.format_id,
        body: first.body ?? r.title ?? "",
        score: r.quality_score != null ? { total: Number(r.quality_score) } : { total: 0, voiceMatch: 0 },
        status: r.status,
        image_url: null as string | null,
        created_at: r.created_at,
        campaign_id: r.campaign_id,
      };
    });
  });

