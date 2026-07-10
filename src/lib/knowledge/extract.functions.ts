// Structured resume extraction from parsed markdown, via Claude thinking.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const StructuredProfileSchema = z.object({
  full_name: z.string().default(""),
  headline: z.string().default(""),
  about: z.string().default(""),
  roles: z
    .array(
      z.object({
        title: z.string().default(""),
        company: z.string().default(""),
        start: z.string().nullable().default(null),
        end: z.string().nullable().default(null),
        summary: z.string().default(""),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string().default(""),
        degree: z.string().default(""),
        field: z.string().default(""),
        start: z.string().nullable().default(null),
        end: z.string().nullable().default(null),
      }),
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
});

export type StructuredProfile = z.infer<typeof StructuredProfileSchema>;

const ExtractInput = z.object({ markdown: z.string().min(20) });

const SYSTEM = `You are a résumé parser. Return ONLY valid JSON matching this exact shape (no prose, no markdown fence):
{
  "full_name": string,
  "headline": string,
  "about": string,
  "roles": [{"title": string, "company": string, "start": string|null, "end": string|null, "summary": string}],
  "education": [{"school": string, "degree": string, "field": string, "start": string|null, "end": string|null}],
  "skills": [string],
  "achievements": [string]
}
Never invent roles, companies, dates, or numbers. If a field is missing from the input, use empty string, null, or [].`;

export const extractResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ExtractInput.parse(i))
  .handler(async ({ data }) => {
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      system: SYSTEM,
      prompt: `Résumé source:\n\n${data.markdown.slice(0, 40000)}\n\nReturn the JSON now.`,
    });
    const jsonStr = result.text.trim().replace(/^```json\s*|\s*```$/g, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // last-resort: pull first {...} block
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Extractor returned non-JSON output.");
      parsed = JSON.parse(m[0]);
    }
    const structured = StructuredProfileSchema.parse(parsed);
    return structured;
  });
