// Orchestrator model config. Verified against the Lovable AI Gateway.
// Fable 5 is Lovable's Claude alias; the gateway resolves it directly.
import { stepCountIs } from "ai";

export const ORCHESTRATOR_MODEL = "openai/gpt-5.6-sol";
export const MAX_TOKENS = 4096;

/** Max tool-loop steps per orchestrated run. */
export const TOOL_STEP_LIMIT = stepCountIs(50);

/** Reasoning effort. GPT-5.6 chat-completions with function tools requires "none". */
export const REASONING_EFFORT: "none" | "low" | "medium" | "high" = "none";

