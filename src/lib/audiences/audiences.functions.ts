// Audience — the fourth pillar alongside Voice, Knowledge, and Domain.
// A robust ICP entity. CRUD + defaults + AI suggester.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

// Structured ICP shape. All fields optional so partial saves work.
export const IcpSchema = z.object({
  persona: z.string().max(400).optional().default(""),
  role_titles: z.array(z.string().max(80)).max(20).optional().default([]),
  industries: z.array(z.string().max(80)).max(20).optional().default([]),
  company_size: z.string().max(80).optional().default(""),
  seniority: z.string().max(80).optional().default(""),
  goals: z.array(z.string().max(200)).max(20).optional().default([]),
  pains: z.array(z.string().max(200)).max(20).optional().default([]),
  channels: z.array(z.string().max(80)).max(20).optional().default([]),
  tone_preference: z.string().max(240).optional().default(""),
  objections: z.array(z.string().max(200)).max(20).optional().default([]),
  success_metrics: z.array(z.string().max(200)).max(20).optional().default([]),
});
export type Icp = z.infer<typeof IcpSchema>;

const AudienceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(800).nullable().optional(),
  emoji: z.string().max(8).nullable().optional(),
  icp: IcpSchema.optional(),
  source_domain_id: z.string().uuid().nullable().optional(),
  source_knowledge_profile_id: z.string().uuid().nullable().optional(),
});

const SELECT_COLS =
  "id, name, description, emoji, icp, is_default, is_ai_generated, source_domain_id, source_knowledge_profile_id, created_at, updated_at";

export const listAudiences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audiences")
      .select(SELECT_COLS)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getAudience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("audiences")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const createAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AudienceInputSchema.parse(i))
  .handler(async ({ data, context }) => {
    // If user has no default yet, make this the default.
    const { data: existingDefault } = await context.supabase
      .from("audiences")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_default", true)
      .maybeSingle();

    const { data: row, error } = await context.supabase
      .from("audiences")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        description: data.description ?? null,
        emoji: data.emoji ?? null,
        icp: (data.icp ?? {}) as unknown as Json,
        source_domain_id: data.source_domain_id ?? null,
        source_knowledge_profile_id: data.source_knowledge_profile_id ?? null,
        is_default: !existingDefault,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return row;
  });

export const updateAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    AudienceInputSchema.partial().extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, icp, ...rest } = data;
    const patch = { ...rest, ...(icp !== undefined ? { icp: icp as unknown as Json } : {}) };
    const { data: row, error } = await context.supabase
      .from("audiences")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("audiences")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setDefaultAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("audiences")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    const { error } = await context.supabase
      .from("audiences")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- AI suggester ----------
const SuggestInput = z.object({
  domain_id: z.string().uuid().nullable().optional(),
  knowledge_profile_id: z.string().uuid().nullable().optional(),
  focus: z.string().max(600).optional(),
});

export const suggestAudienceFromContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => SuggestInput.parse(i))
  .handler(async ({ data, context }) => {
    // Gather grounding context: domain name + knowledge profile name + a few knowledge titles.
    let domainName = "";
    if (data.domain_id) {
      const { data: d } = await context.supabase
        .from("domains").select("name").eq("id", data.domain_id).maybeSingle();
      domainName = d?.name ?? "";
    } else {
      const { data: d } = await context.supabase
        .from("domains").select("name").eq("user_id", context.userId).eq("is_default", true).maybeSingle();
      domainName = d?.name ?? "";
    }

    let profileName = "";
    let profileId = data.knowledge_profile_id ?? null;
    if (!profileId) {
      const { data: p } = await context.supabase
        .from("knowledge_profiles").select("id, name").eq("user_id", context.userId).eq("is_default", true).maybeSingle();
      profileId = p?.id ?? null;
      profileName = p?.name ?? "";
    } else {
      const { data: p } = await context.supabase
        .from("knowledge_profiles").select("name").eq("id", profileId).maybeSingle();
      profileName = p?.name ?? "";
    }

    let knowledgeSnippets: string[] = [];
    if (profileId) {
      const { data: entries } = await context.supabase
        .from("knowledge_entries")
        .select("title, source_type")
        .eq("user_id", context.userId)
        .eq("profile_id", profileId)
        .is("archived_at", null)
        .limit(12);
      knowledgeSnippets = (entries ?? [])
        .map((e) => `- ${e.title ?? "Untitled"} (${e.source_type ?? "note"})`)
        .filter(Boolean);
    }

    const { createLovableAiGatewayProvider } = await import("@/lib/ai/gateway.server");
    const { generateText, Output } = await import("ai");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You define an Ideal Customer Profile (ICP) for a content creator.
Return a concrete, specific ICP grounded in the provided domain and knowledge context.
Prefer concrete titles, industries, and pains over generic phrasing. No filler.`;

    const prompt = [
      `Domain: ${domainName || "(unspecified)"}`,
      `Knowledge profile: ${profileName || "(unspecified)"}`,
      knowledgeSnippets.length ? `Knowledge highlights:\n${knowledgeSnippets.join("\n")}` : "",
      data.focus ? `Additional focus: ${data.focus}` : "",
      "",
      "Produce: a short name (3-6 words), a one-sentence description, and a structured ICP.",
    ].filter(Boolean).join("\n");

    // Small, unconstrained schema (per AI SDK rule: no bounds/enums/lengths).
    const OutSchema = z.object({
      name: z.string(),
      description: z.string(),
      icp: z.object({
        persona: z.string(),
        role_titles: z.array(z.string()),
        industries: z.array(z.string()),
        company_size: z.string(),
        seniority: z.string(),
        goals: z.array(z.string()),
        pains: z.array(z.string()),
        channels: z.array(z.string()),
        tone_preference: z.string(),
        objections: z.array(z.string()),
        success_metrics: z.array(z.string()),
      }),
    });

    try {
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
        experimental_output: Output.object({ schema: OutSchema }),
      });
      return {
        name: String(experimental_output.name || "").slice(0, 120),
        description: String(experimental_output.description || "").slice(0, 800),
        icp: IcpSchema.parse(experimental_output.icp),
        source_domain_id: data.domain_id ?? null,
        source_knowledge_profile_id: profileId,
      };
    } catch (err) {
      console.error("[audiences] suggest failed", err);
      throw new Error("Could not generate an audience right now. Please try again.");
    }
  });

// One-click: generate + save + set default.
export const generateDefaultAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const suggested = await suggestAudienceFromContext({ data: {} });
    const { data: existingDefault } = await context.supabase
      .from("audiences")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_default", true)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("audiences")
      .insert({
        user_id: context.userId,
        name: suggested.name,
        description: suggested.description,
        icp: suggested.icp as unknown as Json,
        source_domain_id: suggested.source_domain_id,
        source_knowledge_profile_id: suggested.source_knowledge_profile_id,
        is_default: !existingDefault,
        is_ai_generated: true,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return row;
  });

// Compact prompt-block renderer used by injection layers.
export function renderAudienceBlock(a: {
  name: string;
  description?: string | null;
  icp?: Icp | Record<string, unknown> | null;
} | null | undefined): string {
  if (!a) return "";
  const icp = (a.icp ?? {}) as Partial<Icp>;
  const lines: string[] = [a.name];
  if (a.description) lines.push(a.description);
  if (icp.persona) lines.push(`Persona: ${icp.persona}`);
  if (icp.role_titles?.length) lines.push(`Roles: ${icp.role_titles.slice(0, 5).join(", ")}`);
  if (icp.industries?.length) lines.push(`Industries: ${icp.industries.slice(0, 5).join(", ")}`);
  if (icp.pains?.length) lines.push(`Pains: ${icp.pains.slice(0, 5).join("; ")}`);
  if (icp.goals?.length) lines.push(`Goals: ${icp.goals.slice(0, 5).join("; ")}`);
  if (icp.channels?.length) lines.push(`Channels: ${icp.channels.slice(0, 5).join(", ")}`);
  if (icp.tone_preference) lines.push(`Tone: ${icp.tone_preference}`);
  return lines.join("\n");
}
