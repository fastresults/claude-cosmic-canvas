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
        meta: { surface: data.surface },
      });
      return { needsVoice: true as const };
    }

    const system = composeOrchestratorSystem({
      voice: loaded.voice,
      directives: loaded.directives,
      context: loaded.context,
      surface: data.surface,
      surfaceInstructions: data.surfaceInstructions,
    });

    const { createOrchestratorProvider } = await import("./gateway.server");
    const { buildOrchestratorTools } = await import("./tools");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS, TOOL_STEP_LIMIT } = await import("./config");

    const gateway = createOrchestratorProvider();
    const tools = buildOrchestratorTools({ supabase, userId });

    const result = await generateText({
      model: gateway(ORCHESTRATOR_MODEL),
      system,
      prompt: data.prompt,
      tools,
      stopWhen: TOOL_STEP_LIMIT,
      maxOutputTokens: MAX_TOKENS,
    });

    const toolCalls = (result.steps ?? []).flatMap((s) =>
      (s.toolCalls ?? []).map((c) => ({ tool: c.toolName, input: c.input })),
    );

    await supabase.from("audit_log").insert({
      actor_user_id: userId,
      action: "generation.orchestrated",
      meta: {
        surface: data.surface,
        voice_id: loaded.voice.id,
        tool_calls: toolCalls,
        steps: result.steps?.length ?? 0,
      },
    });

    return {
      needsVoice: false as const,
      voiceId: loaded.voice.id,
      text: result.text,
      stopReason: result.finishReason ?? null,
      toolCalls,
      usage: {
        input_tokens: result.usage?.inputTokens ?? 0,
        output_tokens: result.usage?.outputTokens ?? 0,
      },
    };
  });
