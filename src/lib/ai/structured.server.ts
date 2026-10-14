// Shared schema-enforced generation. Uses AI SDK Output.object (strict
// json_schema on OpenAI models) and falls back to parsing the raw text when
// the model's output doesn't match. Returns null instead of throwing on
// unparseable output; gateway errors (402/429/...) still propagate.
import type { z } from "zod";

export async function generateStructuredJson<T extends z.ZodTypeAny>(args: {
  model: string;
  system: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T> | null> {
  const { getGatewayKey, createLovableAiGatewayProvider } = await import("./gateway.server");
  const { generateText, Output, NoObjectGeneratedError } = await import("ai");
  const { modelCallOptions } = await import("@/lib/orchestrator/config");
  const provider = createLovableAiGatewayProvider(getGatewayKey(), undefined, {
    structuredOutputs: args.model.startsWith("openai/"),
  });
  try {
    const { output } = await generateText({
      model: provider(args.model),
      system: args.system,
      prompt: args.prompt,
      output: Output.object({ schema: args.schema }),
      ...modelCallOptions(args.model, args.maxTokens ?? 4096),
    });
    return output as z.infer<T>;
  } catch (e) {
    if (!NoObjectGeneratedError.isInstance(e)) throw e;
    const m = (e.text ?? "").match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const r = args.schema.safeParse(JSON.parse(m[0]));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }
}
