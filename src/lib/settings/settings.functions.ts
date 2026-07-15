// All server functions for the Settings sub-pages.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

// ---------- Profile ----------

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, persona_active_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ display_name: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.display_name })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Personas ----------

export const listPersonas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("personas")
      .select("id, name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const createPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("personas")
      .insert({ user_id: context.userId, name: data.name })
      .select("id, name")
      .single();
    if (error) throw error;
    return row;
  });

export const renamePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("personas")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deletePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Clear active pointer if this persona was active.
    await context.supabase
      .from("profiles")
      .update({ persona_active_id: null })
      .eq("user_id", context.userId)
      .eq("persona_active_id", data.id);
    const { error } = await context.supabase.from("personas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setActivePersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ persona_active_id: data.id })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Voice profile ----------

export const getVoiceProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ personaId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("voice_profiles")
      .select("id, samples, directives, signals")
      .eq("persona_id", data.personaId)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const upsertVoiceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        personaId: z.string().uuid(),
        samples: z.array(z.object({ text: z.string(), source: z.string().optional() })),
        directives: z.array(z.string()),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("voice_profiles")
      .select("id")
      .eq("persona_id", data.personaId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("voice_profiles")
        .update({
          samples: data.samples as unknown as Json,
          directives: data.directives as unknown as Json,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("voice_profiles").insert({
        user_id: context.userId,
        persona_id: data.personaId,
        samples: data.samples as unknown as Json,
        directives: data.directives as unknown as Json,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

// ---------- Domains ----------

export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("domains")
      .select("id, name, is_default, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().trim().min(1).max(40) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: existingDefault } = await context.supabase
      .from("domains")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_default", true)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("domains")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        is_default: !existingDefault,
      })
      .select("id, name, is_default")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("domains").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("domains")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    const { error } = await context.supabase
      .from("domains")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Knowledge entries ----------

const KNOWLEDGE_KINDS = ["linkedin", "resume", "note", "url"] as const;

export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_entries")
      .select("id, kind, title, source_url, content, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const addKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        kind: z.enum(KNOWLEDGE_KINDS),
        title: z.string().min(1).max(200),
        source_url: z.string().url().optional().or(z.literal("")),
        content: z.string().max(20000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("knowledge_entries")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        source_url: data.source_url ? data.source_url : null,
        content: data.content ?? null,
      })
      .select("id, kind, title, source_url, content, created_at")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_entries")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Channels ----------

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("channel_connections")
      .select("id, channel, handle, status, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("channel_connections")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
