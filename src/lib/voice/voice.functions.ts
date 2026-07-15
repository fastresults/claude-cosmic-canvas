// Voice system server functions. All AI generation surfaces in this app
// resolve through resolveActiveVoice + formatStyleContext.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import {
  VoiceProfileWriteSchema,
  normalizeVocab,
  cleanSample,
  SAMPLES_MAX,
  VOICE_SIGNAL_TYPES,
} from "./schemas";

// ---------- helpers ----------

/* eslint-disable @typescript-eslint/no-explicit-any */

async function upsertBrainNode(
  supabase: any,
  userId: string,
  voiceId: string,
  name: string,
) {
  await supabase.from("entities").insert({
    user_id: userId,
    kind: "voice",
    name,
    meta: { voice_profile_id: voiceId } as unknown as Json,
  });
}

async function deleteBrainNodes(supabase: any, userId: string, voiceId: string) {
  await supabase
    .from("entities")
    .delete()
    .eq("user_id", userId)
    .eq("kind", "voice")
    .contains("meta", { voice_profile_id: voiceId });
}

async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  meta: Record<string, unknown> = {},
) {
  try {
    await supabase.from("audit_log").insert({
      actor_user_id: userId,
      action,
      meta: meta as unknown as Json,
    });
  } catch {
    // audit failures should never break user flows
  }
}


// ---------- CRUD ----------

export const listVoiceProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ personaId: z.string().uuid().nullable().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("voice_profiles")
      .select(
        "id, name, category, tone, guidelines, vocabulary_preferred, vocabulary_avoid, formality, humor, technicality, conciseness, is_default, source, persona_id, samples, updated_at, created_at",
      )
      .order("updated_at", { ascending: false });
    if (data.personaId !== undefined) {
      query = data.personaId === null
        ? query.is("persona_id", null)
        : query.eq("persona_id", data.personaId);
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const getVoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const createVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => VoiceProfileWriteSchema.parse(i))
  .handler(async ({ data, context }) => {
    const vocab = normalizeVocab(data.vocabulary_preferred, data.vocabulary_avoid);
    const samples = (data.samples ?? []).slice(0, SAMPLES_MAX).map((s) => ({
      text: cleanSample(s.text),
      source: s.source,
    }));
    const { data: row, error } = await context.supabase
      .from("voice_profiles")
      .insert({
        user_id: context.userId,
        name: data.name,
        category: data.category ?? null,
        tone: data.tone ?? null,
        guidelines: data.guidelines ?? null,
        vocabulary_preferred: vocab.preferred,
        vocabulary_avoid: vocab.avoid,
        formality: data.formality,
        humor: data.humor,
        technicality: data.technicality,
        conciseness: data.conciseness,
        samples: samples as unknown as Json,
        persona_id: data.persona_id ?? null,
        source: data.source ?? "scratch",
        is_default: false,
      })
      .select("id, name")
      .single();
    if (error) throw error;
    await upsertBrainNode(context.supabase, context.userId, row.id, row.name);
    await logAudit(context.supabase, context.userId, "voice.created", {
      voice_id: row.id,
      source: data.source ?? "scratch",
    });
    return row;
  });

export const updateVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .and(VoiceProfileWriteSchema.partial())
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      patch[k] = v;
    }
    if (patch.vocabulary_preferred || patch.vocabulary_avoid) {
      const { data: current } = await context.supabase
        .from("voice_profiles")
        .select("vocabulary_preferred, vocabulary_avoid, name")
        .eq("id", id)
        .single();
      const pref = (patch.vocabulary_preferred as string[]) ??
        current?.vocabulary_preferred ?? [];
      const avoid = (patch.vocabulary_avoid as string[]) ??
        current?.vocabulary_avoid ?? [];
      const vocab = normalizeVocab(pref, avoid);
      patch.vocabulary_preferred = vocab.preferred;
      patch.vocabulary_avoid = vocab.avoid;
    }
    if (patch.samples) {
      patch.samples = (patch.samples as Array<{ text: string; source?: string }>)
        .slice(0, SAMPLES_MAX)
        .map((s) => ({ text: cleanSample(s.text), source: s.source })) as unknown as Json;
    }
    const { error } = await context.supabase
      .from("voice_profiles")
      .update(patch as never)
      .eq("id", id);

    if (error) throw error;
    // Keep brain node name in sync if it changed
    if (typeof patch.name === "string") {
      await context.supabase
        .from("entities")
        .update({ name: patch.name })
        .eq("user_id", context.userId)
        .eq("kind", "voice")
        .contains("meta", { voice_profile_id: id });
    }
    await logAudit(context.supabase, context.userId, "voice.updated", {
      voice_id: id,
      fields: Object.keys(patch),
    });
    return { ok: true };
  });

export const deleteVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Clear active/default pointers first
    await context.supabase
      .from("profiles")
      .update({ active_voice_id: null })
      .eq("user_id", context.userId)
      .eq("active_voice_id", data.id);
    await deleteBrainNodes(context.supabase, context.userId, data.id);
    const { error } = await context.supabase
      .from("voice_profiles")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    await logAudit(context.supabase, context.userId, "voice.deleted", {
      voice_id: data.id,
    });
    return { ok: true };
  });

export const duplicateVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", data.id)
      .single();
    if (e1 || !src) throw e1 ?? new Error("Not found");
    const { id: _id, created_at: _c, updated_at: _u, is_default: _d, ...rest } = src as Record<
      string,
      unknown
    >;
    void _id; void _c; void _u; void _d;
    const insertRow = {
      ...rest,
      user_id: context.userId,
      name: `${src.name} (copy)`,
      is_default: false,
    };
    const { data: row, error } = await context.supabase
      .from("voice_profiles")
      .insert(insertRow)
      .select("id, name")
      .single();
    if (error) throw error;
    await upsertBrainNode(context.supabase, context.userId, row.id, row.name);
    return row;
  });

// ---------- default + active selection ----------

export const setDefaultVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Fetch scope
    const { data: row } = await context.supabase
      .from("voice_profiles")
      .select("persona_id")
      .eq("id", data.id)
      .single();
    // Unset others in scope, then set this one — done via two updates
    const unset = context.supabase
      .from("voice_profiles")
      .update({ is_default: false })
      .eq("user_id", context.userId);
    const scoped = row?.persona_id
      ? unset.eq("persona_id", row.persona_id)
      : unset.is("persona_id", null);
    await scoped;
    const { error } = await context.supabase
      .from("voice_profiles")
      .update({ is_default: true })
      .eq("id", data.id);
    if (error) throw error;
    // Default is the global voice — also make it active so every AI surface
    // (composer, workspaces, drafts, orchestrator) picks it up immediately.
    await context.supabase
      .from("profiles")
      .update({ active_voice_id: data.id })
      .eq("user_id", context.userId);
    await logAudit(context.supabase, context.userId, "voice.set_default", {
      voice_id: data.id,
    });
    return { ok: true };
  });

export const setActiveVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ active_voice_id: data.id })
      .eq("user_id", context.userId);
    if (error) throw error;
    await logAudit(context.supabase, context.userId, "voice.activated", {
      voice_id: data.id,
    });
    return { ok: true };
  });

export const getActiveVoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("active_voice_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile?.active_voice_id) return null;
    const { data: voice } = await context.supabase
      .from("voice_profiles")
      .select(
        "id, name, category, tone, formality, humor, technicality, conciseness, is_default",
      )
      .eq("id", profile.active_voice_id)
      .maybeSingle();
    return voice;
  });

/**
 * Server-side: resolve the profile a generation should use.
 * Order: explicit override → user active → scope default → user default → first.
 * Returns null when the user has zero voices.
 */
export const resolveActiveVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        overrideId: z.string().uuid().optional(),
        personaId: z.string().uuid().nullable().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pick = async (id: string) => {
      const { data: v } = await supabase
        .from("voice_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return v;
    };
    if (data.overrideId) {
      const v = await pick(data.overrideId);
      if (v) return v;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("active_voice_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof?.active_voice_id) {
      const v = await pick(prof.active_voice_id);
      if (v) return v;
    }
    // Scope default
    let scopeQuery = supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true);
    scopeQuery = data.personaId
      ? scopeQuery.eq("persona_id", data.personaId)
      : scopeQuery.is("persona_id", null);
    const { data: scoped } = await scopeQuery.maybeSingle();
    if (scoped) return scoped;
    // Any default
    const { data: anyDefault } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    if (anyDefault) return anyDefault;
    // First profile
    const { data: first } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return first ?? null;
  });

// ---------- system voices ----------

export const listSystemVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ category: z.string().optional(), q: z.string().optional() })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("system_voices")
      .select("id, name, profession, tagline, category, tone")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    if (data.category) q = q.eq("category", data.category);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const adoptSystemVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("system_voices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw error ?? new Error("System voice not found");
    const { data: row, error: e2 } = await context.supabase
      .from("voice_profiles")
      .insert({
        user_id: context.userId,
        name: data.name ?? src.name,
        category: src.category,
        tone: src.tone,
        guidelines: src.guidelines,
        vocabulary_preferred: src.vocabulary_preferred,
        vocabulary_avoid: src.vocabulary_avoid,
        formality: src.formality,
        humor: src.humor,
        technicality: src.technicality,
        conciseness: src.conciseness,
        samples: src.samples,
        source: "persona",
      })
      .select("id, name")
      .single();
    if (e2) throw e2;
    await upsertBrainNode(context.supabase, context.userId, row.id, row.name);
    // Adopting = "start using this voice now". Make it the user's default and
    // active voice so every downstream flow (composer, workspaces, drafts,
    // orchestrator) picks it up immediately.
    await context.supabase
      .from("voice_profiles")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .is("persona_id", null);
    await context.supabase
      .from("voice_profiles")
      .update({ is_default: true })
      .eq("id", row.id);
    await context.supabase
      .from("profiles")
      .update({ active_voice_id: row.id })
      .eq("user_id", context.userId);
    await logAudit(context.supabase, context.userId, "voice.adopted_from_persona", {
      voice_id: row.id,
      system_voice_id: data.id,
      set_default: true,
    });
    return row;
  });


// ---------- signals + directives ----------

export const captureVoiceSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        signalType: z.enum(VOICE_SIGNAL_TYPES),
        originalText: z.string().min(1).max(20000),
        editedText: z.string().max(20000).optional(),
        voiceProfileId: z.string().uuid().optional(),
        context: z.record(z.string(), z.any()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    try {
      await context.supabase.from("voice_signals").insert({
        user_id: context.userId,
        signal_type: data.signalType,
        original_text: data.originalText,
        edited_text: data.editedText ?? null,
        voice_profile_id: data.voiceProfileId ?? null,
        context: (data.context ?? {}) as unknown as Json,
      });
    } catch {
      // never fail the host action
    }
    return { ok: true };
  });

export const listDirectives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        voiceProfileId: z.string().uuid(),
        status: z.enum(["suggested", "active", "dismissed"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("voice_directives")
      .select("id, directive_type, directive_text, evidence_count, status, updated_at")
      .eq("voice_profile_id", data.voiceProfileId)
      .order("evidence_count", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const updateDirective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["suggested", "active", "dismissed"]).optional(),
        directive_text: z.string().min(1).max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("voice_directives")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteDirective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("voice_directives").delete().eq("id", data.id);
    return { ok: true };
  });

export const getLearningSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("voice_learning_settings")
      .select("auto_promote_threshold, enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? { auto_promote_threshold: 3, enabled: true };
  });

export const updateLearningSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        auto_promote_threshold: z.number().int().min(1).max(50).optional(),
        enabled: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("voice_learning_settings")
      .upsert({ user_id: context.userId, ...data });
    if (error) throw error;
    return { ok: true };
  });

// ---------- AI pipelines ----------

const AiSample = z.object({ text: z.string() });
const AiProfile = z.object({
  name: z.string(),
  tone: z.string(),
  guidelines: z.string(),
  vocabulary_preferred: z.array(z.string()),
  vocabulary_avoid: z.array(z.string()),
  formality: z.number(),
  humor: z.number(),
  technicality: z.number(),
  conciseness: z.number(),
  samples: z.array(AiSample),
});

async function generateStructured<T extends z.ZodTypeAny>(args: {
  model: string;
  system?: string;
  prompt: string;
  schema: T;
}): Promise<z.infer<T> | null> {
  const { getGatewayKey, createLovableAiGatewayProvider } = await import(
    "@/lib/ai/gateway.server"
  );
  const { generateText, Output, NoObjectGeneratedError } = await import("ai");
  try {
    const provider = createLovableAiGatewayProvider(getGatewayKey(), undefined, {
      structuredOutputs: args.model.startsWith("openai/"),
    });
    const { output } = await generateText({
      model: provider(args.model),
      system: args.system,
      prompt: args.prompt,
      output: Output.object({ schema: args.schema }),
    });
    return output as z.infer<T>;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance?.(e)) {
      const text = (e as unknown as { text?: string }).text ?? "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) return args.schema.parse(JSON.parse(jsonMatch[0]));
      } catch {
        // fall through
      }
    }
    return null;
  }
}

export const analyzeOwnVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ samples: z.array(z.string().min(20).max(4000)).min(1).max(10) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await logAudit(context.supabase, context.userId, "voice.analyze_started");
    const out = await generateStructured({
      model: "openai/gpt-5.5",
      system:
        "You extract a writer's voice signature from their samples. Sliders are 0-100 (higher = more of that trait). Return concise vocabulary lists (max 15 items each). Guidelines should be a bullet list.",
      prompt: `Analyze these samples and return a full voice profile:\n\n${data.samples
        .map((s, i) => `--- Sample ${i + 1} ---\n${s}`)
        .join("\n")}`,
      schema: AiProfile,
    });
    await logAudit(context.supabase, context.userId, "voice.analyze_completed", {
      fallback: !out,
    });
    if (!out) return { fallback: true as const };
    return { fallback: false as const, profile: out };
  });

export const researchVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        focus: z.string().max(200).optional(),
        depth: z.enum(["quick", "deep"]).default("quick"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await logAudit(context.supabase, context.userId, "voice.research_started", {
      target: data.name,
      depth: data.depth,
    });
    const model = data.depth === "deep" ? "openai/gpt-5.5" : "google/gemini-2.5-flash";
    const out = await generateStructured({
      model,
      system:
        "You reconstruct a public communicator's writing voice from public knowledge. Never invent private facts. Sliders 0-100.",
      prompt: `Communicator: ${data.name}${
        data.focus ? `\nFocus: ${data.focus}` : ""
      }\nReturn a full voice profile including tone, guidelines (bullet list of do/dont), vocabulary preferred/avoid (max 15 each), the 4 sliders, and 2 short reference sample paragraphs written IN THEIR VOICE.`,
      schema: AiProfile,
    });
    await logAudit(context.supabase, context.userId, "voice.research_completed", {
      fallback: !out,
    });
    if (!out) return { fallback: true as const };
    return { fallback: false as const, profile: out };
  });

export const enrichVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ partial: AiProfile.partial() }).parse(i))
  .handler(async ({ data }) => {
    const out = await generateStructured({
      model: "google/gemini-2.5-flash",
      system: "Fill missing fields in the given voice profile. Do not overwrite provided fields.",
      prompt: `Partial:\n${JSON.stringify(data.partial)}`,
      schema: AiProfile,
    });
    return out ? { fallback: false as const, profile: out } : { fallback: true as const };
  });

export const generateVoiceSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ voiceProfileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", data.voiceProfileId)
      .maybeSingle();
    if (!profile) throw new Error("Voice not found");
    const out = await generateStructured({
      model: "google/gemini-2.5-flash",
      system: "Write 3 short paragraphs (60-120 words each) in this voice.",
      prompt: `Voice profile:\n${JSON.stringify({
        tone: profile.tone,
        guidelines: profile.guidelines,
        sliders: {
          formality: profile.formality,
          humor: profile.humor,
          technicality: profile.technicality,
          conciseness: profile.conciseness,
        },
        vocabulary_preferred: profile.vocabulary_preferred,
        vocabulary_avoid: profile.vocabulary_avoid,
      })}`,
      schema: z.object({ samples: z.array(z.string()) }),
    });
    if (!out) return { fallback: true as const, samples: [] };
    return { fallback: false as const, samples: out.samples.slice(0, 3) };
  });

export const validateVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ text: z.string().min(1).max(20000), voiceProfileId: z.string().uuid() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", data.voiceProfileId)
      .maybeSingle();
    if (!profile) throw new Error("Voice not found");
    const { data: directives } = await context.supabase
      .from("voice_directives")
      .select("directive_type, directive_text, evidence_count")
      .eq("voice_profile_id", data.voiceProfileId)
      .eq("status", "active");
    const { formatStyleContext } = await import("./format-style-context.server");
    const context_str = formatStyleContext(profile, { activeDirectives: directives ?? [] });
    const out = await generateStructured({
      model: "google/gemini-2.5-flash",
      system:
        "Score how well a text matches a voice profile. Return score 0-100, up to 5 issues, up to 5 suggestions.",
      prompt: `VOICE PROFILE:\n${context_str}\n\nTEXT TO SCORE:\n${data.text}`,
      schema: z.object({
        score: z.number(),
        issues: z.array(z.string()),
        suggestions: z.array(z.string()),
      }),
    });
    if (!out) return { fallback: true as const, score: 0, issues: [], suggestions: [] };
    return {
      fallback: false as const,
      score: Math.max(0, Math.min(100, Math.round(out.score))),
      issues: out.issues.slice(0, 5),
      suggestions: out.suggestions.slice(0, 5),
    };
  });

export const distillVoiceDirectives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ voiceProfileId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: signals } = await context.supabase
      .from("voice_signals")
      .select("id, signal_type, original_text, edited_text, context")
      .eq("user_id", context.userId)
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(25);
    if (!signals?.length) return { promoted: 0 };
    const out = await generateStructured({
      model: "google/gemini-2.5-flash",
      system:
        "Distill 1-5 concrete writing directives from these user edits. Each: type (avoid_word, prefer_word, avoid_pattern, prefer_pattern, tone_shift, structural), and text (a short imperative rule).",
      prompt: `Signals:\n${JSON.stringify(signals)}`,
      schema: z.object({
        directives: z.array(
          z.object({
            directive_type: z.enum([
              "avoid_word",
              "prefer_word",
              "avoid_pattern",
              "prefer_pattern",
              "tone_shift",
              "structural",
            ]),
            directive_text: z.string(),
          }),
        ),
      }),
    });
    if (!out) return { promoted: 0, fallback: true };
    const { data: settings } = await context.supabase
      .from("voice_learning_settings")
      .select("auto_promote_threshold")
      .eq("user_id", context.userId)
      .maybeSingle();
    const threshold = settings?.auto_promote_threshold ?? 3;
    let promoted = 0;
    for (const d of out.directives.slice(0, 5)) {
      // Try upsert-by-uniqueness (voice_profile_id, type, lower(text))
      const { data: existing } = await context.supabase
        .from("voice_directives")
        .select("id, evidence_count, status")
        .eq("voice_profile_id", data.voiceProfileId)
        .eq("directive_type", d.directive_type)
        .ilike("directive_text", d.directive_text)
        .maybeSingle();
      if (existing) {
        const next = existing.evidence_count + 1;
        const shouldPromote =
          existing.status === "suggested" && next >= threshold;
        if (shouldPromote) promoted++;
        await context.supabase
          .from("voice_directives")
          .update({
            evidence_count: next,
            status: shouldPromote ? "active" : existing.status,
          })
          .eq("id", existing.id);
      } else {
        await context.supabase.from("voice_directives").insert({
          user_id: context.userId,
          voice_profile_id: data.voiceProfileId,
          directive_type: d.directive_type,
          directive_text: d.directive_text,
          evidence_count: 1,
          status: "suggested",
        });
      }
    }
    await context.supabase
      .from("voice_signals")
      .update({ processed_at: new Date().toISOString() })
      .in("id", signals.map((s) => s.id));
    if (promoted > 0) {
      await logAudit(context.supabase, context.userId, "directive.promoted", {
        voice_id: data.voiceProfileId,
        count: promoted,
      });
    }
    return { promoted };
  });
