// Orchestrator model config. Verified against the Lovable AI Gateway.
// Fable 5 is Lovable's Claude alias; the gateway resolves it directly.
import { stepCountIs, type ProviderOptions } from "ai";

import { MODELS } from "@/lib/ai/models";

export const ORCHESTRATOR_MODEL = MODELS.orchestrator;
export const MAX_TOKENS = 4096;

/** Max tool-loop steps per orchestrated run. */
export const TOOL_STEP_LIMIT = stepCountIs(50);

/** Reasoning effort. GPT-5.6 chat-completions with function tools requires "none". */
export const REASONING_EFFORT: "none" | "low" | "medium" | "high" = "none";


/**
 * Token-limit + reasoning options for a model. GPT-5.6 rejects `max_tokens`
 * and needs reasoning_effort "none" with tools, so the cap goes through
 * providerOptions as `max_completion_tokens` instead of `maxOutputTokens`.
 * GPT-6 (Responses API) requires reasoning (low+) and rejects temperature/
 * top_p; per the upgrade policy its optional output cap is omitted.
 */
type ModelCallOptions = {
  providerOptions?: ProviderOptions;
  maxOutputTokens?: number;
};

export function modelCallOptions(model: string, maxTokens: number): ModelCallOptions {
  if (/^openai\/gpt-6/.test(model)) {
    return {
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    };
  }
  if (/^openai\/gpt-5\.6/.test(model)) {
    return {
      providerOptions: {
        lovable: { max_completion_tokens: maxTokens, reasoningEffort: "none" as const },
      },
    };
  }
  // Other GPT-5 family models also take max_completion_tokens, not max_tokens.
  if (/^openai\/gpt-5/.test(model)) {
    return { providerOptions: { lovable: { max_completion_tokens: maxTokens } } };
  }
  return { maxOutputTokens: maxTokens };
}
