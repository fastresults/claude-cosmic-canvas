// Server-only orchestrator model client.
// Backed by Lovable AI Gateway (AI SDK), not api.anthropic.com — but keeps the
// original `callAnthropic({model, maxTokens, prompt, system})` shape so every
// existing caller (create, drafts, milestones, knowledge, onboarding, library,
// content) keeps working without change.
import { generateText } from "ai";
import { createOrchestratorProvider } from "./gateway.server";

type OrchestratorCallInput = {
  model: string;
  maxTokens: number;
  prompt: string;
  system?: string;
};

export async function callAnthropic({
  model,
  maxTokens,
  prompt,
  system,
}: OrchestratorCallInput) {
  const gateway = createOrchestratorProvider();

  // GPT-5.6 (openai/gpt-5.6-*) rejects `max_tokens` and requires
  // `reasoning_effort: "none"` when tools/function-calling are in play. The
  // AI SDK's openai-compatible provider would serialize `maxOutputTokens` as
  // `max_tokens`, so on GPT-5.6 we forward the limit as `max_completion_tokens`
  // via providerOptions passthrough instead of setting `maxOutputTokens`.
  const isGpt56 = /^openai\/gpt-5\.6/.test(model);

  const result = await generateText({
    model: gateway(model),
    system,
    prompt,
    ...(isGpt56 ? {} : { maxOutputTokens: maxTokens }),
    ...(isGpt56
      ? {
          providerOptions: {
            lovable: {
              max_completion_tokens: maxTokens,
              reasoningEffort: "none",
            },
          },
        }
      : {}),
  });

  return {
    text: result.text,
    stopReason: result.finishReason ?? null,
    usage: {
      input_tokens: result.usage?.inputTokens ?? 0,
      output_tokens: result.usage?.outputTokens ?? 0,
    },
  };
}

