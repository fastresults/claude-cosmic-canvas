// Presets — server functions for CRUD, brain sync, seed-based auto-build, and apply.
import { createServerFn } from "@tanstack/react-start";
import { aiRateLimit } from "@/lib/rate-limit/ai-rate-limit";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

// ---------- Schemas ----------

const BriefConfigSchema = z
  .object({
    tone: z.string().optional(),
    strategicGoal: z.string().optional(),
    strategicGoalDescription: z.string().optional(),
    statisticsDensity: z.number().min(0).max(4).optional(),
    emotionalStyle: z.number().min(0).max(4).optional(),
    defaultContentType: z.string().optional(),
    defaultLength: z.string().optional(),
  })
  .passthrough();

const FactorWeightsSchema = z.record(z.string(), z.number().min(0).max(1));

const PresetInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  brief_config: BriefConfigSchema.optional().default({}),
  selected_domain_ids: z.array(z.string().uuid()).optional().default([]),
  selected_audience_ids: z.array(z.string().uuid()).optional().default([]),
  factor_weights: FactorWeightsSchema.optional().default({}),
  research_context: z
    .object({
      summary: z.string().optional(),
      items: z
        .array(
          z.object({
            content: z.string(),
            source: z.string().optional(),
            relevance: z.number().optional(),
          }),
        )
        .optional(),
    })
    .passthrough()
    .optional()
    .default({}),
});

// ---------- CRUD ----------

export const listPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("presets")
      .select(
        "id, name, description, brief_config, selected_domain_ids, selected_audience_ids, factor_weights, research_context, is_default, is_favorite, use_count, last_used_at, archived_at, created_at, updated_at",
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getPreset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: preset, error } = await context.supabase
      .from("presets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!preset) return null;
    const { data: docs } = await context.supabase
      .from("preset_documents")
      .select("*")
      .eq("preset_id", data.id)
      .order("saved_at", { ascending: false });
    return { ...preset, documents: docs ?? [] };
  });

export const createPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PresetInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("presets")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        brief_config: data.brief_config as unknown as Json,
        selected_domain_ids: data.selected_domain_ids,
        selected_audience_ids: data.selected_audience_ids,
        factor_weights: data.factor_weights as unknown as Json,
        research_context: data.research_context as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    await syncPresetToBrainInternal(context.supabase, context.userId, row.id);
    return row;
  });

export const updatePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).merge(PresetInputSchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.description !== undefined) patch.description = rest.description;
    if (rest.brief_config !== undefined) patch.brief_config = rest.brief_config;
    if (rest.selected_domain_ids !== undefined) patch.selected_domain_ids = rest.selected_domain_ids;
    if (rest.selected_audience_ids !== undefined) patch.selected_audience_ids = rest.selected_audience_ids;
    if (rest.factor_weights !== undefined) patch.factor_weights = rest.factor_weights;
    if (rest.research_context !== undefined) patch.research_context = rest.research_context;

    const { error } = await context.supabase.from("presets").update(patch as never).eq("id", id);
    if (error) throw error;
    await syncPresetToBrainInternal(context.supabase, context.userId, id);
    return { ok: true };
  });

export const deletePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Remove brain edges owned by this preset (targets stay intact).
    await context.supabase
      .from("brain_edges")
      .delete()
      .eq("user_id", context.userId)
      .eq("src_type", "preset")
      .eq("src_id", data.id);
    const { error } = await context.supabase.from("presets").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const archivePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("presets")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const favoritePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), favorite: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("presets")
      .update({ is_favorite: data.favorite })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Clear any existing default first (partial unique index enforces one).
    await context.supabase
      .from("presets")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    if (data.id) {
      const { error } = await context.supabase
        .from("presets")
        .update({ is_default: true })
        .eq("id", data.id);
      if (error) throw error;
    }
    return { ok: true };
  });

// ---------- Preset documents ----------

const DocInputSchema = z.object({
  preset_id: z.string().uuid(),
  source_type: z.enum(["url", "file", "paste", "linkedin", "resume", "voice"]),
  source_url: z.string().url().optional().nullable(),
  file_name: z.string().max(200).optional().nullable(),
  file_type: z.string().max(120).optional().nullable(),
  file_size: z.number().int().optional().nullable(),
  extracted_text: z.string().optional().nullable(),
  structured: z.unknown().optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export const addPresetDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DocInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("preset_documents")
      .insert({
        user_id: context.userId,
        preset_id: data.preset_id,
        source_type: data.source_type,
        source_url: data.source_url ?? null,
        file_name: data.file_name ?? null,
        file_type: data.file_type ?? null,
        file_size: data.file_size ?? null,
        extracted_text: data.extracted_text ?? null,
        structured: (data.structured ?? null) as unknown as Json,
        priority: data.priority,
      })
      .select("id")
      .single();
    if (error) throw error;
    await syncPresetToBrainInternal(context.supabase, context.userId, data.preset_id);
    return row;
  });

export const deletePresetDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Grab preset_id first so we can resync.
    const { data: doc } = await context.supabase
      .from("preset_documents")
      .select("preset_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("preset_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    if (doc?.preset_id) {
      await syncPresetToBrainInternal(context.supabase, context.userId, doc.preset_id);
    }
    return { ok: true };
  });

// ---------- Audiences ----------

export const listAudiences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audiences")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("audiences")
      .insert({ user_id: context.userId, name: data.name.trim() })
      .select("id, name")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("audiences").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Build from seed (AI-powered auto-populate) ----------

const BuildInputSchema = z.object({
  seed: z.string().min(3).max(4000),
});

export const buildPresetFromSeed = createServerFn({ method: "POST" })
  .middleware([aiRateLimit])
  .inputValidator((i: unknown) => BuildInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Pull user's existing domains + audiences to bias suggestions.
    const [{ data: domains }, { data: audiences }] = await Promise.all([
      context.supabase.from("domains").select("name"),
      context.supabase.from("audiences").select("name"),
    ]);

    const existingDomains = (domains ?? []).map((d) => d.name);
    const existingAudiences = (audiences ?? []).map((a) => a.name);

    const { createLovableAiGatewayProvider, getGatewayKey } = await import(
      "@/lib/ai/gateway.server"
    );
    const { generateText, Output } = await import("ai");
    const { modelCallOptions } = await import("@/lib/orchestrator/config");

    const provider = createLovableAiGatewayProvider(getGatewayKey(), undefined, {
      structuredOutputs: true,
    });

    const schema = z.object({
      name: z.string(),
      description: z.string(),
      brief_config: z.object({
        tone: z.string(),
        strategicGoal: z.string(),
        strategicGoalDescription: z.string(),
        statisticsDensity: z.number().min(0).max(4),
        emotionalStyle: z.number().min(0).max(4),
        defaultContentType: z.string(),
        defaultLength: z.string(),
      }),
      suggested_domains: z.array(z.string()).max(6),
      suggested_audiences: z.array(z.string()).max(6),
      research_summary: z.string(),
      research_items: z
        .array(
          z.object({
            content: z.string(),
            source: z.string().optional(),
            relevance: z.number().min(0).max(1).optional(),
          }),
        )
        .max(6),
    });

    const system = `You design content presets — reusable lenses combining voice, domain, audience, and reference material. Given a short seed, produce a fully populated preset draft. Prefer terse, specific values over generic ones. Reuse existing domain/audience names verbatim when a good match exists.`;

    const userPrompt = [
      `SEED:\n${data.seed}`,
      existingDomains.length ? `EXISTING_DOMAINS: ${existingDomains.join(", ")}` : "",
      existingAudiences.length ? `EXISTING_AUDIENCES: ${existingAudiences.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { output } = await generateText({
      model: provider("openai/gpt-5.5"),
      system,
      prompt: userPrompt,
      output: Output.object({ schema }),
      ...modelCallOptions("openai/gpt-5.5", 4096),
    });

    return output;
  });

// ---------- Apply (build injection payload) ----------

const ApplyInputSchema = z.object({
  preset_id: z.string().uuid(),
  task: z.string().min(1).max(8000),
  surface: z.string().max(60).optional(),
});

export const applyPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ApplyInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: preset, error } = await context.supabase
      .from("presets")
      .select(
        "id, name, brief_config, selected_domain_ids, selected_audience_ids, factor_weights, use_count",
      )
      .eq("id", data.preset_id)
      .maybeSingle();
    if (error) throw error;
    if (!preset) throw new Error("Preset not found");

    // Hydrate domain names + audience names.
    const [{ data: domainRows }, { data: audienceRows }, { data: docRows }] = await Promise.all([
      preset.selected_domain_ids?.length
        ? context.supabase.from("domains").select("name").in("id", preset.selected_domain_ids)
        : Promise.resolve({ data: [] as { name: string }[] }),
      preset.selected_audience_ids?.length
        ? context.supabase.from("audiences").select("name").in("id", preset.selected_audience_ids)
        : Promise.resolve({ data: [] as { name: string }[] }),
      context.supabase
        .from("preset_documents")
        .select("file_name, source_url, source_type, extracted_text, priority")
        .eq("preset_id", data.preset_id),
    ]);

    // Best-effort knowledge chunk retrieval from the document texts.
    // (v1: literal snippets from preset_documents. Semantic recall via
    // match_knowledge_chunks can be added later when preset docs are
    // ingested into knowledge_chunks.)
    const hits = (docRows ?? [])
      .filter((d) => d.extracted_text)
      .slice(0, 8)
      .map((d, idx) => ({
        chunkId: `doc-${idx}`,
        entryId: `doc-${idx}`,
        entryTitle: d.file_name ?? d.source_url ?? d.source_type,
        sourceType: d.source_type,
        content: (d.extracted_text ?? "").slice(0, 1200),
      }));

    // Increment usage.
    await context.supabase
      .from("presets")
      .update({
        use_count: (preset.use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", data.preset_id);
    await context.supabase.from("preset_usage").insert({
      user_id: context.userId,
      preset_id: data.preset_id,
      surface: data.surface ?? null,
    });

    const { buildPresetPrompt } = await import("@/lib/presets/injection");
    const built = buildPresetPrompt({
      domains: (domainRows ?? []).map((d) => d.name),
      audiences: (audienceRows ?? []).map((a) => a.name),
      voice: null,
      briefConfig: (preset.brief_config as Record<string, unknown>) ?? {},
      factorWeights: (preset.factor_weights as Record<string, number>) ?? {},
      hits,
      task: data.task,
    });

    return { ...built, presetId: data.preset_id, presetName: preset.name };
  });

// ---------- Brain sync (internal) ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncPresetToBrainInternal(supabase: any, userId: string, presetId: string) {
  // Fetch preset + docs.
  const { data: preset } = (await supabase
    .from("presets")
    .select(
      "id, selected_domain_ids, selected_audience_ids",
    )
    .eq("id", presetId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          selected_domain_ids: string[] | null;
          selected_audience_ids: string[] | null;
        }
      | null;
  };
  if (!preset) return;

  const { data: docs } = (await supabase
    .from("preset_documents")
    .select("id, priority, knowledge_entry_id")
    .eq("preset_id", presetId)) as {
    data:
      | Array<{ id: string; priority: string; knowledge_entry_id: string | null }>
      | null;
  };

  // Clear existing outgoing edges for this preset (idempotent resync).
  await supabase
    .from("brain_edges")
    .delete()
    .eq("user_id", userId)
    .eq("src_type", "preset")
    .eq("src_id", presetId);

  const weight = (p: string) =>
    p === "high" ? 1.0 : p === "low" ? 0.3 : 0.6;

  const rows: Array<Record<string, unknown>> = [];
  // you --EXPERT_IN--> preset
  rows.push({
    user_id: userId,
    src_type: "you",
    src_id: userId,
    edge_kind: "EXPERT_IN",
    dst_type: "preset",
    dst_id: presetId,
    meta: {},
  });
  for (const domainId of preset.selected_domain_ids ?? []) {
    rows.push({
      user_id: userId,
      src_type: "preset",
      src_id: presetId,
      edge_kind: "SCOPES_DOMAIN",
      dst_type: "domain",
      dst_id: domainId,
      meta: {},
    });
  }
  for (const audId of preset.selected_audience_ids ?? []) {
    rows.push({
      user_id: userId,
      src_type: "preset",
      src_id: presetId,
      edge_kind: "TARGETS_AUDIENCE",
      dst_type: "audience",
      dst_id: audId,
      meta: {},
    });
  }
  for (const doc of docs ?? []) {
    rows.push({
      user_id: userId,
      src_type: "preset",
      src_id: presetId,
      edge_kind: "REFERENCES_DOC",
      dst_type: "document",
      dst_id: doc.id,
      meta: { weight: weight(doc.priority) },
    });
    if (doc.knowledge_entry_id) {
      rows.push({
        user_id: userId,
        src_type: "preset",
        src_id: presetId,
        edge_kind: "SOURCED_FROM",
        dst_type: "knowledge",
        dst_id: doc.knowledge_entry_id,
        meta: {},
      });
    }
  }

  if (rows.length) {
    await supabase.from("brain_edges").insert(rows);
  }
}
