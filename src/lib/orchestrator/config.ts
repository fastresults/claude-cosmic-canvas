// Orchestrator model config. Verified against the Lovable AI Gateway.
// Fable 5 is Lovable's Claude alias; the gateway resolves it directly.
import { stepCountIs } from "ai";

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
 */
export function modelCallOptions(model: string, maxTokens: number) {
  if (/^openai\/gpt-5\.6/.test(model)) {
    return {
      providerOptions: {
        lovable: { max_completion_tokens: maxTokens, reasoningEffort: "none" as const },
      },
    };
  }
  return { maxOutputTokens: maxTokens };
}
