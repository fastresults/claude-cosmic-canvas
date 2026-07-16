// One-shot backfill: re-format an existing knowledge entry as a beautified résumé.
// Owner-scoped via RLS on `knowledge_entries`.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({ entryId: z.string().uuid() });

export const backfillResumeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entry, error } = await supabase
      .from("knowledge_entries")
      .select("id, content, title, meta, kind, source_type")
      .eq("id", data.entryId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!entry) throw new Error("Entry not found");

    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { StructuredProfileSchema } = await import("./extract.functions");
    const { beautifyResumeMarkdown: _unused, formatResumeFallback } = await import("./beautify.functions");
    void _unused;


    // 1. Extract structured
    const extractSystem = `You are a résumé parser. Return ONLY valid JSON: {"full_name":string,"headline":string,"about":string,"roles":[{"title":string,"company":string,"start":string|null,"end":string|null,"summary":string}],"education":[{"school":string,"degree":string,"field":string,"start":string|null,"end":string|null}],"skills":[string],"achievements":[string]}. Never invent facts.`;
    const extracted = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      system: extractSystem,
      prompt: `Résumé source:\n\n${(entry.content ?? "").slice(0, 40000)}\n\nReturn the JSON now.`,
    });
    const jsonStr = extracted.text.trim().replace(/^```json\s*|\s*```$/g, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const m = jsonStr.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Extractor returned non-JSON");
      parsed = JSON.parse(m[0]);
    }
    const structured = StructuredProfileSchema.parse(parsed);

    // 2. Beautify inline (don't RPC into a sibling server fn)

    const beautifySystem = [
      "You are a résumé formatter. Return ONLY GitHub-flavored Markdown — no preamble, no code fences.",
      "Sections in order (omit any with no data): # Name, italic headline line, About paragraph, ## Experience (### Title — Company + italic date range + summary), ## Education (bullets), ## Skills (comma list), ## Achievements (bullets), ## Contact (bullets pulled from raw source).",
      "Never invent facts. Prefer structured JSON; use raw text only to fill gaps. Use en-dashes for date ranges.",
    ].join("\n");
    let markdown = "";
    let model: string | null = null;
    try {
      const b = await callAnthropic({
        model: ORCHESTRATOR_MODEL,
        maxTokens: MAX_TOKENS,
        system: beautifySystem,
        prompt: `STRUCTURED JSON:\n${JSON.stringify(structured, null, 2)}\n\n---RAW SOURCE---\n${(entry.content ?? "").slice(0, 40000)}\n\nReturn the beautified Markdown now.`,
      });
      const md = b.text.trim().replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
      if (md.length >= 20) {
        markdown = md;
        model = ORCHESTRATOR_MODEL;
      }
    } catch {
      /* fall through to fallback */
    }
    if (!markdown) markdown = formatResumeFallback(structured, entry.content ?? "");


    // 3. Update the entry
    const existingMeta = (entry.meta && typeof entry.meta === "object" ? entry.meta : {}) as Record<string, unknown>;
    const { error: updateErr } = await supabase
      .from("knowledge_entries")
      .update({
        content: markdown,
        kind: "resume",
        meta: {
          ...existingMeta,
          structured,
          formatted_by: model ? "ai" : "fallback",
          formatter_model: model,
          backfilled_at: new Date().toISOString(),
        },
      })
      .eq("id", data.entryId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true, chars: markdown.length, model };
  });
