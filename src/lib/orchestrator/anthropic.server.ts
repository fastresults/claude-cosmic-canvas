// Server-only orchestrator model client.
// Backed by Lovable AI Gateway (AI SDK), not api.anthropic.com — but keeps the
// original `callAnthropic({model, maxTokens, prompt, system})` shape so every
// existing caller (create, drafts, milestones, knowledge, onboarding, library,
// content) keeps working without change.
import { runStreamed } from "@/lib/ai/stream.server";
import { resolveGatewayModel } from "@/lib/ai/gateway.server";
import { modelCallOptions } from "./config";

type OrchestratorCallInput = {
  model: string;
  maxTokens: number;
  prompt: string;
  system?: string;
  onTextDelta?: (text: string) => void;
};

export async function callAnthropic({
  model,
  maxTokens,
  prompt,
  system,
  onTextDelta,
}: OrchestratorCallInput) {
  const result = await runStreamed(
    {
      model: resolveGatewayModel(model),
      system,
      prompt,
      ...modelCallOptions(model, maxTokens),
    },
    { onTextDelta },
  );

  return {
    text: result.text,
    stopReason: result.finishReason ?? null,
    usage: {
      input_tokens: result.usage?.inputTokens ?? 0,
      output_tokens: result.usage?.outputTokens ?? 0,
    },
  };
}

