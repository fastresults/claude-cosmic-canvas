// Tool-using orchestrator variant. Fable 5 runs a bounded tool loop against
// the registry in ./tools, gated by the user's active voice. Non-streaming;
// for the streaming Copilot surface, wire a server route on top of the same
// core (see .lovable/plan.md §4).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";

const OrchestrateWithToolsInput = z.object({
  prompt: z.string().min(1),
  surfaceInstructions: z.string().optional(),
  surface: z
    .enum(["generic", "create", "milestone", "brain", "knowledge", "copilot"])
    .default("generic"),
  voiceOverrideId: z.string().uuid().optional(),
  includeMilestoneContext: z.boolean().default(false),
});

export const orchestrateWithTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrchestrateWithToolsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startedAt = Date.now();

    try {
      const { loadOrchestratorContext, composeOrchestratorSystem } = await import("./system.server");
      const loaded = await loadOrchestratorContext(supabase, userId, {
        voiceId: data.voiceOverrideId ?? null,
        intent: data.prompt,
        includeMilestoneContext: data.includeMilestoneContext,
      });

      if (loaded.needsVoice) {
        await supabase.from("audit_log").insert({
          actor_user_id: userId,
          action: "generation.blocked_no_voice",
          meta: { surface: data.surface, duration_ms: Date.now() - startedAt },
        });
        return { needsVoice: true as const };
      }

      const system = composeOrchestratorSystem({
        voice: loaded.voice,
        directives: loaded.directives,
        context: loaded.context,
        audience: loaded.audience,
        surface: data.surface,
        surfaceInstructions: data.surfaceInstructions,
      });

      const { createOrchestratorProvider } = await import("./gateway.server");
      const { buildOrchestratorTools } = await import("./tools");
      const { ORCHESTRATOR_MODEL, MAX_TOKENS, TOOL_STEP_LIMIT, REASONING_EFFORT } = await import("./config");

      const gateway = createOrchestratorProvider();
      const tools = buildOrchestratorTools({ supabase, userId });

      const result = await generateText({
        model: gateway(ORCHESTRATOR_MODEL),
        system,
        prompt: data.prompt,
        tools,
        stopWhen: TOOL_STEP_LIMIT,
        maxOutputTokens: MAX_TOKENS,
        providerOptions: { lovable: { reasoningEffort: REASONING_EFFORT } },
      });

      const toolCalls: Array<{ tool: string; input: string }> = (result.steps ?? []).flatMap((s) =>
        (s.toolCalls ?? []).map((c) => ({
          tool: c.toolName,
          input: JSON.stringify(c.input ?? null),
        })),
      );

      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;

      await supabase.from("audit_log").insert({
        actor_user_id: userId,
        action: "generation.orchestrated",
        meta: {
          surface: data.surface,
          voice_id: loaded.voice.id,
          tool_calls: toolCalls,
          steps: result.steps?.length ?? 0,
          duration_ms: Date.now() - startedAt,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          finish_reason: result.finishReason ?? null,
        },
      });

      return {
        needsVoice: false as const,
        voiceId: loaded.voice.id,
        text: result.text,
        stopReason: result.finishReason ?? null,
        toolCalls,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from("audit_log")
        .insert({
          actor_user_id: userId,
          action: "generation.failed",
          meta: {
            surface: data.surface,
            duration_ms: Date.now() - startedAt,
            error: message.slice(0, 500),
          },
        })
        .then(() => undefined, () => undefined);
      throw error;
    }
  });
