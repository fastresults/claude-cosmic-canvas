import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrchestrateInput = z.object({
  prompt: z.string().min(1),
  system: z.string().optional(),
  voiceOverrideId: z.string().uuid().optional(),
  personaId: z.string().uuid().nullable().optional(),
});

/**
 * Every generation is gated by the user's active voice. If the user has
 * NO voices, this returns { needsVoice: true } — never a silent fallback.
 */
export const orchestrate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrchestrateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startedAt = Date.now();

    try {
      async function pick(id: string) {
        const { data: v } = await supabase
          .from("voice_profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        return v;
      }

      let voice = null as Awaited<ReturnType<typeof pick>>;
      if (data.voiceOverrideId) voice = await pick(data.voiceOverrideId);
      if (!voice) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("active_voice_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (prof?.active_voice_id) voice = await pick(prof.active_voice_id);
      }
      if (!voice) {
        const { data: def } = await supabase
          .from("voice_profiles")
          .select("*")
          .eq("user_id", userId)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle();
        voice = def;
      }
      if (!voice) {
        const { data: first } = await supabase
          .from("voice_profiles")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        voice = first;
      }

      if (!voice) {
        await supabase.from("audit_log").insert({
          actor_user_id: userId,
          action: "generation.blocked_no_voice",
          meta: { duration_ms: Date.now() - startedAt },
        });
        return { needsVoice: true as const };
      }

      const { data: directives } = await supabase
        .from("voice_directives")
        .select("directive_type, directive_text, evidence_count")
        .eq("voice_profile_id", voice.id)
        .eq("status", "active");

      const { formatStyleContext } = await import("@/lib/voice/format-style-context.server");
      const styleBlock = formatStyleContext(voice, {
        activeDirectives: directives ?? [],
      });

      const composedSystem = data.system
        ? `${styleBlock}\n\n---\n\n${data.system}`
        : styleBlock;

      const { callAnthropic } = await import("./anthropic.server");
      const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("./config");

      const result = await callAnthropic({
        model: ORCHESTRATOR_MODEL,
        maxTokens: MAX_TOKENS,
        prompt: data.prompt,
        system: composedSystem,
      });

      await supabase.from("audit_log").insert({
        actor_user_id: userId,
        action: "generation.used_voice",
        meta: {
          voice_id: voice.id,
          had_directives: (directives?.length ?? 0) > 0,
          duration_ms: Date.now() - startedAt,
        },
      });

      return { needsVoice: false as const, voiceId: voice.id, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from("audit_log")
        .insert({
          actor_user_id: userId,
          action: "generation.failed",
          meta: { surface: "orchestrate", duration_ms: Date.now() - startedAt, error: message.slice(0, 500) },
        })
        .then(() => undefined, () => undefined);
      throw error;
    }
  });
