// Content pipeline server functions.
// Claude Fable 5 drafts under a persona/voice profile; every generation
// writes brain provenance edges.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DraftInput = z.object({
  prompt: z.string().min(1),
  format: z.string().default("post"),
  campaignId: z.string().uuid().optional(),
});

export const contentDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { writeEdgesServer } = await import("@/lib/ai/provenance.server");

    // Pull active persona + voice signals (best-effort; empty on first run).
    const { data: profile } = await supabase
      .from("profiles")
      .select("persona_active_id, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    let personaName: string | null = null;
    let voiceDirectives: unknown = null;
    let voiceSignals: unknown = null;
    let personaId: string | null = profile?.persona_active_id ?? null;

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

    const system = [
      "You are Eve, an on-brand ghostwriter.",
      personaName ? `Writing as: ${personaName}.` : `Writing as: ${profile?.display_name ?? "the user"}.`,
      voiceDirectives ? `Voice directives: ${JSON.stringify(voiceDirectives)}` : "",
      voiceSignals ? `Voice signals: ${JSON.stringify(voiceSignals)}` : "",
      `Return ONLY the final ${data.format} body. No preamble, no commentary, no markdown fences.`,
      "Match the user's cadence. Concrete over abstract. Never fabricate facts.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt: data.prompt,
      system,
    });

    const body = result.text.trim();

    // Insert the draft row.
    const { data: draft, error: draftErr } = await supabase
      .from("drafts")
      .insert({
        user_id: userId,
        format: data.format,
        body,
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

    // Write brain provenance edges.
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
          prompt: data.prompt.slice(0, 500),
          format: data.format,
          usage: result.usage,
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

    return { draft, usage: result.usage };
  });

export const listRecentDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drafts")
      .select("id, format, body, score, status, image_url, created_at, campaign_id")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return data ?? [];
  });
