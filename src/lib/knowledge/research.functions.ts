// AI-powered deep research — write a grounded brief for a domain, save as an entry.
import { MODELS } from "@/lib/ai/models";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ingestEntry } from "./knowledge.functions";

const RunDeepResearchInput = z.object({
  topic: z.string().min(3).max(400),
  domain_id: z.string().uuid().nullable().optional(),
  domain_name: z.string().max(120).optional(),
  profile_id: z.string().uuid().nullable().optional(),
});

export const runDeepResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RunDeepResearchInput.parse(i))
  .handler(async ({ data, context }) => {
    const { enforceRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit/rate-limit.server");
    await enforceRateLimit(context.supabase, RATE_LIMITS.research_company);
    const { createLovableAiGatewayProvider } = await import("@/lib/ai/gateway.server");
    const { generateText } = await import("ai");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const domainLine = data.domain_name ? `Domain: ${data.domain_name}` : "";
    const system = `You are a rigorous research analyst producing evidence-rich briefs for a knowledge base that grounds AI-written content.
Return well-structured Markdown with these sections:
# {Topic}
## TL;DR
## Key facts
## Context and history
## Debates and open questions
## Notable sources
Cite sources inline as [source: publication/author]. Prefer specific numbers, names, dates. No filler.`;

    const prompt = `${domainLine}
Research topic: ${data.topic}

Write a ~600-900 word brief following the required structure. Use only well-known, verifiable information. If uncertain, say so.`;

    const { text } = await generateText({
      model: gateway(MODELS.research),
      system,
      prompt,
      maxOutputTokens: 4096,
    });

    if (!text || text.trim().length < 50) {
      throw new Error("Research returned empty. Try a more specific topic.");
    }

    try {
      return await ingestEntry({
        data: {
          profile_id: data.profile_id ?? null,
          domain_id: data.domain_id ?? null,
          source_type: "research",
          title: data.topic.slice(0, 120),
          content: text,
          tags: ["ai-research"],
          kind: "note",
          meta: {
            topic: data.topic,
            domain: data.domain_name ?? null,
            model: MODELS.research,
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[runDeepResearch] ingestEntry failed", {
        topic: data.topic,
        domain_id: data.domain_id ?? null,
        error: msg,
      });
      const preview = text.slice(0, 200).replace(/\s+/g, " ");
      throw new Error(
        `Research generated but could not be saved: ${msg}. Preview: "${preview}…"`,
      );
    }
  });
