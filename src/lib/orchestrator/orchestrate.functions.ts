import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OrchestrateInput = z.object({
  prompt: z.string().min(1),
  system: z.string().optional(),
});

export const orchestrate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OrchestrateInput.parse(input))
  .handler(async ({ data }) => {
    const { callAnthropic } = await import("./anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("./config");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt: data.prompt,
      system: data.system,
    });

    return result;
  });
