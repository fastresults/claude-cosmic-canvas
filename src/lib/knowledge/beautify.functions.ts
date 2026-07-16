// AI-formatted résumé/CV markdown. Every résumé & LinkedIn import funnels
// through this so entries render as clean, human-readable Markdown instead of
// a raw parsed dump.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { StructuredProfileSchema, type StructuredProfile } from "./extract.functions";

const BeautifyInput = z.object({
  structured: StructuredProfileSchema,
  rawMarkdown: z.string().default(""),
  fileName: z.string().optional(),
});

const SYSTEM = [
  "You are a résumé formatter. Return ONLY GitHub-flavored Markdown — no preamble, no explanations, no code fences around the output.",
  "Format the résumé using this section order, omitting any section that has no data:",
  "1. `# {Full Name}`",
  "2. Italic headline on its own line: `_{headline}_`",
  "3. A short About paragraph (only if present).",
  "4. `## Experience` — each role as `### {Title} — {Company}` followed by a line with the date range in italics, then a short bullet or paragraph summary.",
  "5. `## Education` — each entry as a bullet: `- **{Degree} {Field}** — {School} ({start} – {end})`.",
  "6. `## Skills` — comma-separated inline list.",
  "7. `## Achievements` — bulleted list.",
  "8. `## Contact` — bullets for email, phone, location, website, LinkedIn/social URLs (only if you can pull them from the raw source).",
  "Rules: never invent facts, roles, employers, dates, or numbers. Prefer the structured JSON; use the raw text only to fill in contact details, missing dates, or descriptions the JSON lacks. Keep prose tight and scannable. Use en-dashes for date ranges.",
].join("\n");

export function formatResumeFallback(structured: StructuredProfile, rawMarkdown: string): string {
  const parts: (string | false | 0 | null | undefined)[] = [
    structured.full_name && `# ${structured.full_name}`,
    structured.headline && `_${structured.headline}_`,
    structured.about,
    structured.roles.length &&
      `## Experience\n${structured.roles
        .map(
          (r) =>
            `### ${r.title || "Untitled role"} — ${r.company}\n_${r.start ?? "?"} – ${r.end ?? "present"}_${
              r.summary ? `\n\n${r.summary}` : ""
            }`,
        )
        .join("\n\n")}`,
    structured.education.length &&
      `## Education\n${structured.education
        .map(
          (e) =>
            `- **${e.degree}${e.field ? ` ${e.field}` : ""}** — ${e.school} (${e.start ?? "?"} – ${e.end ?? "?"})`,
        )
        .join("\n")}`,
    structured.skills.length && `## Skills\n${structured.skills.join(", ")}`,
    structured.achievements.length &&
      `## Achievements\n${structured.achievements.map((a) => `- ${a}`).join("\n")}`,
    rawMarkdown ? `\n---\n\n<details><summary>Original source</summary>\n\n${rawMarkdown.slice(0, 20000)}\n\n</details>` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

export const beautifyResumeMarkdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BeautifyInput.parse(i))
  .handler(async ({ data }) => {
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");

    const prompt = [
      "STRUCTURED JSON (authoritative — prefer these values):",
      JSON.stringify(data.structured, null, 2),
      "",
      "---RAW SOURCE (use only to fill gaps such as contact details or missing dates)---",
      data.rawMarkdown.slice(0, 40000),
      "",
      "Return the beautified Markdown now.",
    ].join("\n");

    try {
      const result = await callAnthropic({
        model: ORCHESTRATOR_MODEL,
        maxTokens: MAX_TOKENS,
        system: SYSTEM,
        prompt,
      });
      const md = result.text.trim().replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
      if (md.length < 20) {
        return { markdown: formatResumeFallback(data.structured, data.rawMarkdown), model: null as string | null };
      }
      return { markdown: md, model: ORCHESTRATOR_MODEL };
    } catch {
      return { markdown: formatResumeFallback(data.structured, data.rawMarkdown), model: null as string | null };
    }
  });
