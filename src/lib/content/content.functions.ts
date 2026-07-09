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

async function loadPersonaContext(
  supabase: Awaited<
    ReturnType<typeof import("@/integrations/supabase/auth-middleware").requireSupabaseAuth>
  > extends never
    ? never
    : any,
  userId: string,
) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("persona_active_id")
      .eq("user_id", userId)
      .maybeSingle();
    const personaId: string | null = profile?.persona_active_id ?? null;

    const { data: draft, error: draftErr } = await supabase
      .from("drafts")
      .insert({
        user_id: userId,
        format: data.format,
        body: data.body,
        hooks: [],
        score: { total: 0, voiceMatch: 0 },
        status: "draft",
        campaign_id: data.campaignId ?? null,
      })
      .select("id, format, body, score, status, created_at")
      .single();

    if (draftErr || !draft) {
      throw new Error(`Failed to save draft: ${draftErr?.message ?? "unknown"}`);
    }

    const edges: Parameters<typeof writeEdgesServer>[2] = [
      {
        srcType: "you",
        srcId: userId,
        edgeKind: "GENERATED_BY_TOOL",
        dstType: "draft",
        dstId: draft.id,
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
        dstId: draft.id,
      });
    }
    await writeEdgesServer(supabase, userId, edges);

    return { draft };
  });

export const listRecentDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drafts")
      .select("id, format, body, score, status, image_url, created_at, campaign_id")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data ?? [];
  });
