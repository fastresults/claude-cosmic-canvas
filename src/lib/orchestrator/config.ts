// Orchestrator model config. Verified against the Lovable AI Gateway.
// Fable 5 is Lovable's Claude alias; the gateway resolves it directly.
import { stepCountIs } from "ai";

export const ORCHESTRATOR_MODEL = "claude-fable-5";
export const MAX_TOKENS = 4096;

/** Max tool-loop steps per orchestrated run. */
export const TOOL_STEP_LIMIT = stepCountIs(50);

/** Reasoning effort for Fable 5 when the SDK/provider surface exposes it. */
export const REASONING_EFFORT: "none" | "low" | "medium" | "high" = "medium";
