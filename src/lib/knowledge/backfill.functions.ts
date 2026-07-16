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
    const { beautifyResumeMarkdown, formatResumeFallback } = await import("./beautify.functions");

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

    // 2. Beautify — call the underlying handler directly by re-using its logic
    const { markdown, model } = await beautifyResumeMarkdown({
      data: { structured, rawMarkdown: entry.content ?? "", fileName: entry.title },
    }).catch(() => ({
      markdown: formatResumeFallback(structured, entry.content ?? ""),
      model: null as string | null,
    }));

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
