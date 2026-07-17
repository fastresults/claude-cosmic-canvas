// Default profiles: one-click bundles of Voice + Knowledge + Domain.
// Distinct from "presets" (content lenses: domains + audiences + brief config).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(600).nullable().optional(),
  emoji: z.string().max(8).nullable().optional(),
  voice_id: z.string().uuid().nullable().optional(),
  knowledge_profile_id: z.string().uuid().nullable().optional(),
  domain_id: z.string().uuid().nullable().optional(),
  audience_id: z.string().uuid().nullable().optional(),
});

export const listDefaultProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("default_profiles")
      .select(
        "id, name, description, emoji, voice_id, knowledge_profile_id, domain_id, audience_id, is_default, is_favorite, use_count, last_used_at, created_at, updated_at",
      )
      .order("is_favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProfileInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("default_profiles")
      .insert({ ...data, user_id: context.userId })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    ProfileInputSchema.partial().extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("default_profiles")
      .update(rest)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("default_profiles")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const favoriteDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), favorite: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("default_profiles")
      .update({ is_favorite: data.favorite })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Clear existing default first, respecting the partial-unique index.
    await context.supabase
      .from("default_profiles")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    if (data.id) {
      const { error } = await context.supabase
        .from("default_profiles")
        .update({ is_default: true })
        .eq("id", data.id);
      if (error) throw error;
    }
    return { ok: true };
  });

/**
 * The key one-click action. Applies a profile by:
 *  - Setting profiles.active_voice_id (mirrors setActiveVoice)
 *  - Toggling is_default on knowledge_profiles and domains
 *  - Bumping use_count / last_used_at on the profile
 */
export const applyDefaultProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: profile, error: pErr } = await context.supabase
      .from("default_profiles")
      .select("id, voice_id, knowledge_profile_id, domain_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Profile not found");

    // 1. Voice (via profiles.active_voice_id)
    if (profile.voice_id) {
      await context.supabase
        .from("profiles")
        .update({ active_voice_id: profile.voice_id })
        .eq("user_id", context.userId);
    }

    // 2. Knowledge default
    if (profile.knowledge_profile_id) {
      await context.supabase
        .from("knowledge_profiles")
        .update({ is_default: false })
        .eq("user_id", context.userId)
        .eq("is_default", true);
      await context.supabase
        .from("knowledge_profiles")
        .update({ is_default: true })
        .eq("id", profile.knowledge_profile_id);
    }

    // 3. Domain default
    if (profile.domain_id) {
      await context.supabase
        .from("domains")
        .update({ is_default: false })
        .eq("user_id", context.userId)
        .eq("is_default", true);
      await context.supabase
        .from("domains")
        .update({ is_default: true })
        .eq("id", profile.domain_id);
    }

    // 4. Bump usage + mark as the active profile.
    await context.supabase
      .from("default_profiles")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    await context.supabase
      .from("default_profiles")
      .update({
        is_default: true,
        use_count: 0, // placeholder; increment below
        last_used_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    // Read-then-write increment (Supabase JS lacks a SQL-expression update).
    const { data: cur } = await context.supabase
      .from("default_profiles")
      .select("use_count")
      .eq("id", data.id)
      .maybeSingle();
    if (cur) {
      await context.supabase
        .from("default_profiles")
        .update({ use_count: (cur.use_count ?? 0) + 1 })
        .eq("id", data.id);
    }

    return { ok: true };
  });
