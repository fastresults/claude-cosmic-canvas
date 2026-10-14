// Audience — the fourth pillar alongside Voice, Knowledge, and Domain.
// A robust ICP entity. CRUD + defaults + AI suggester.
import { createServerFn } from "@tanstack/react-start";
import { aiRateLimit } from "@/lib/rate-limit/ai-rate-limit";
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
      .order("created_at", { ascending: true });
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
    const { data: selected, error: selectedError } = await context.supabase
      .from("audiences")
      .select("id, name")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (selectedError) throw selectedError;
    if (!selected) throw new Error("Audience not found");

    const { error: clearError } = await context.supabase
      .from("audiences")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    if (clearError) throw clearError;

    const { error: setError } = await context.supabase
      .from("audiences")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (setError) throw setError;

    const { error: profileError } = await context.supabase
      .from("default_profiles")
      .update({ audience_id: selected.id })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    if (profileError) throw profileError;

    return { ok: true, audience: selected };
  });

// ---------- AI suggester ----------
const ExistingAudienceRef = z.object({
  name: z.string(),
  persona: z.string().optional().default(""),
  role_titles: z.array(z.string()).optional().default([]),
  industries: z.array(z.string()).optional().default([]),
});
const SuggestInput = z.object({
  domain_id: z.string().uuid().nullable().optional(),
  knowledge_profile_id: z.string().uuid().nullable().optional(),
  focus: z.string().max(600).optional(),
  existing: z.array(ExistingAudienceRef).max(50).optional(),
  avoid_names: z.array(z.string()).max(50).optional(),
});

async function runSuggestion(params: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  data: z.infer<typeof SuggestInput>;
}) {
  const { supabase, userId, data } = params;

  // Domain
  let domainName = "";
  if (data.domain_id) {
    const { data: d } = await supabase
      .from("domains").select("name").eq("id", data.domain_id).maybeSingle();
    domainName = d?.name ?? "";
  } else {
    const { data: d } = await supabase
      .from("domains").select("name").eq("user_id", userId).eq("is_default", true).maybeSingle();
    domainName = d?.name ?? "";
  }

  // Knowledge profile
  let profileName = "";
  let profileId = data.knowledge_profile_id ?? null;
  if (!profileId) {
    const { data: p } = await supabase
      .from("knowledge_profiles").select("id, name").eq("user_id", userId).eq("is_default", true).maybeSingle();
    profileId = p?.id ?? null;
    profileName = p?.name ?? "";
  } else {
    const { data: p } = await supabase
      .from("knowledge_profiles").select("name").eq("id", profileId).maybeSingle();
    profileName = p?.name ?? "";
  }

  // Knowledge snippets
  let knowledgeSnippets: string[] = [];
  if (profileId) {
    const { data: entries } = await supabase
      .from("knowledge_entries")
      .select("title, source_type")
      .eq("user_id", userId)
      .eq("profile_id", profileId)
      .is("archived_at", null)
      .limit(12);
    knowledgeSnippets = (entries ?? [])
      .map((e) => `- ${e.title ?? "Untitled"} (${e.source_type ?? "note"})`)
      .filter(Boolean);
  }

  // Existing audiences — auto-fetch if caller didn't pass them.
  let existing = data.existing;
  if (!existing) {
    const { data: rows } = await supabase
      .from("audiences")
      .select("name, icp")
      .eq("user_id", userId);
    existing = (rows ?? []).map((r) => {
      const icp = (r.icp ?? {}) as Partial<Icp>;
      return {
        name: r.name,
        persona: icp.persona ?? "",
        role_titles: icp.role_titles ?? [],
        industries: icp.industries ?? [],
      };
    });
  }

  const existingBlock = existing.length
    ? "Existing audiences (do NOT duplicate):\n" +
      existing.map((e) => {
        const bits = [e.persona].filter(Boolean);
        if (e.role_titles?.length) bits.push(`roles: ${e.role_titles.slice(0, 4).join(", ")}`);
        if (e.industries?.length) bits.push(`industries: ${e.industries.slice(0, 4).join(", ")}`);
        return `- ${e.name}${bits.length ? ` — ${bits.join(" | ")}` : ""}`;
      }).join("\n")
    : "";

  const avoidBlock = data.avoid_names?.length
    ? `Also avoid these recently-drafted names/personas: ${data.avoid_names.join(" | ")}`
    : "";

  const { createLovableAiGatewayProvider } = await import("@/lib/ai/gateway.server");
  const { generateText, Output, NoObjectGeneratedError } = await import("ai");
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const gateway = createLovableAiGatewayProvider(key);

  const system = `You define Ideal Customer Profiles (ICPs) for a content creator.
Propose the NEXT most valuable ICP for this creator, ranked by addressable size, buying intent, and fit with the domain and knowledge context.
It MUST be meaningfully distinct from every audience already listed — no overlapping persona, role titles, or industries.
If an obvious high-value ICP is already covered, pick the next-best gap.
If every strong ICP is already covered, return a narrower sub-segment of an under-served vertical rather than a duplicate.
Return concrete titles, industries, and pains. No filler, no generic phrasing.`;

  const prompt = [
    `Domain: ${domainName || "(unspecified)"}`,
    `Knowledge profile: ${profileName || "(unspecified)"}`,
    knowledgeSnippets.length ? `Knowledge highlights:\n${knowledgeSnippets.join("\n")}` : "",
    existingBlock,
    avoidBlock,
    data.focus ? `Additional focus: ${data.focus}` : "",
    "",
    "Produce: a short name (3-6 words), a one-sentence description, and a structured ICP.",
  ].filter(Boolean).join("\n");

  const OutSchema = z.object({
    name: z.string().nullish(),
    description: z.string().nullish(),
    icp: z.object({
      persona: z.string().nullish(),
      role_titles: z.array(z.string()).nullish(),
      industries: z.array(z.string()).nullish(),
      company_size: z.string().nullish(),
      seniority: z.string().nullish(),
      goals: z.array(z.string()).nullish(),
      pains: z.array(z.string()).nullish(),
      channels: z.array(z.string()).nullish(),
      tone_preference: z.string().nullish(),
      objections: z.array(z.string()).nullish(),
      success_metrics: z.array(z.string()).nullish(),
    }).nullish(),
  });

  const safeJsonParse = (text: string | undefined): Record<string, unknown> | null => {
    if (!text) return null;
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    try { return JSON.parse(cleaned); } catch { return null; }
  };

  let raw: Record<string, unknown> = {};
  try {
    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      output: Output.object({ schema: OutSchema }),
    });
    raw = (output ?? {}) as Record<string, unknown>;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      raw = safeJsonParse((err as { text?: string }).text) ?? {};
    } else {
      console.error("[audiences] suggest failed", err);
      throw new Error("Could not generate an audience right now. Please try again.");
    }
  }

  const rawIcp = (raw.icp ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

  const name = str(raw.name).trim() || `${domainName || "General"} audience`;
  const description = str(raw.description).trim();
  const icp = IcpSchema.parse({
    persona: str(rawIcp.persona),
    role_titles: arr(rawIcp.role_titles),
    industries: arr(rawIcp.industries),
    company_size: str(rawIcp.company_size),
    seniority: str(rawIcp.seniority),
    goals: arr(rawIcp.goals),
    pains: arr(rawIcp.pains),
    channels: arr(rawIcp.channels),
    tone_preference: str(rawIcp.tone_preference),
    objections: arr(rawIcp.objections),
    success_metrics: arr(rawIcp.success_metrics),
  });

  // Duplicate detection
  const norm = (s: string) => s.toLowerCase().trim();
  const overlap = (a: string[], b: string[]) => {
    const set = new Set(a.map(norm));
    return b.some((x) => set.has(norm(x)));
  };
  const duplicateOf = existing.find((e) =>
    norm(e.name) === norm(name) ||
    (e.persona && icp.persona && norm(e.persona) === norm(icp.persona)) ||
    overlap(e.role_titles ?? [], icp.role_titles ?? []) ||
    overlap(e.industries ?? [], icp.industries ?? []),
  );

  return {
    result: {
      name: name.slice(0, 120),
      description: description.slice(0, 800),
      icp,
      source_domain_id: data.domain_id ?? null,
      source_knowledge_profile_id: profileId,
      is_duplicate_warning: !!duplicateOf,
      duplicate_of: duplicateOf?.name ?? null,
    },
    existing,
  };
}

export const suggestAudienceFromContext = createServerFn({ method: "POST" })
  .middleware([aiRateLimit])
  .inputValidator((i: unknown) => SuggestInput.parse(i))
  .handler(async ({ data, context }) => {
    const first = await runSuggestion({ supabase: context.supabase, userId: context.userId, data });
    if (!first.result.is_duplicate_warning) return first.result;

    // One retry with an explicit nudge
    const retry = await runSuggestion({
      supabase: context.supabase,
      userId: context.userId,
      data: {
        ...data,
        existing: first.existing,
        avoid_names: [
          ...(data.avoid_names ?? []),
          first.result.name,
          ...(first.result.icp.persona ? [first.result.icp.persona] : []),
        ],
      },
    });
    return retry.result;
  });




// One-click: generate + save + set default.
export const generateDefaultAudience = createServerFn({ method: "POST" })
  .middleware([aiRateLimit])
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
