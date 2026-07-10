/**
 * Drafts hub — server functions.
 * Single-table (`create_drafts`) reads/writes plus per-draft image
 * association via `create_media`. Every mutation writes a Brain edge.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const IdInput = z.object({ id: z.string().uuid() });
const DraftIdInput = z.object({ draftId: z.string().uuid() });

// -------- List / read ----------------------------------------------------

const ListInput = z
  .object({
    formatId: z.string().optional(),
    status: z.enum(["draft", "ready", "archived", "scheduled", "published"]).optional(),
    archived: z.boolean().default(false),
    workspaceId: z.string().uuid().nullable().optional(),
    excludeWorkspaceScoped: z.boolean().default(true),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(60),
    cursor: z.string().datetime().nullable().optional(),
  })
  .default({ archived: false, excludeWorkspaceScoped: true, limit: 60 });

export const listDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("create_drafts")
      .select(
        "id, format_id, title, sections, status, archived, quality_score, virality_score, authenticity_score, platform, scheduled_date, published_at, workspace_id, campaign_id, updated_at, created_at",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(data.limit);

    q = data.archived ? q.eq("archived", true) : q.eq("archived", false);
    if (data.formatId) q = q.eq("format_id", data.formatId);
    if (data.status) q = q.eq("status", data.status);
    if (data.workspaceId) q = q.eq("workspace_id", data.workspaceId);
    else if (data.excludeWorkspaceScoped) q = q.is("workspace_id", null);
    if (data.cursor) q = q.lt("updated_at", data.cursor);
    if (data.search && data.search.trim()) q = q.ilike("title", `%${data.search.trim()}%`);

    const { data: rows, error } = await q;
    if (error) throw error;

    // Batch-fetch cover thumbs for these drafts (one round-trip).
    const ids = (rows ?? []).map((r) => r.id);
    let mediaByDraft: Record<string, { id: string; url: string; role: string | null }[]> = {};
    if (ids.length) {
      const { data: media } = await context.supabase
        .from("create_media")
        .select("id, url, role, draft_id, sort_order")
        .in("draft_id", ids)
        .order("sort_order", { ascending: true });
      for (const m of media ?? []) {
        if (!m.draft_id) continue;
        (mediaByDraft[m.draft_id] ||= []).push({ id: m.id, url: m.url, role: m.role });
      }
    }
    return (rows ?? []).map((r) => ({ ...r, media: mediaByDraft[r.id] ?? [] }));
  });

export const getDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("create_drafts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    const [{ data: media }, { data: history }] = await Promise.all([
      context.supabase
        .from("create_media")
        .select("id, url, role, generated_by, aspect_ratio, prompt, style_id, parent_image_id, sort_order, created_at")
        .eq("draft_id", data.id)
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("create_version_history")
        .select("id, sections, reason, created_at")
        .eq("draft_id", data.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return { draft: row, media: media ?? [], history: history ?? [] };
  });

// -------- Archive / restore / duplicate / move ---------------------------

export const archiveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ archived: true, status: "archived" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
    await writeEdgeServer(context.supabase, context.userId, {
      srcType: "you",
      srcId: context.userId,
      edgeKind: "PART_OF",
      dstType: "draft",
      dstId: data.id,
      meta: { event: "archived" },
    });
    return { ok: true };
  });

export const restoreDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ archived: false, status: "draft" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
    await writeEdgeServer(context.supabase, context.userId, {
      srcType: "you",
      srcId: context.userId,
      edgeKind: "PART_OF",
      dstType: "draft",
      dstId: data.id,
      meta: { event: "restored" },
    });
    return { ok: true };
  });

export const duplicateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase
      .from("create_drafts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (e1) throw e1;
    if (!src) throw new Error("Draft not found");
    const s = src as Record<string, unknown>;
    const insertRow = {
      user_id: context.userId,
      format_id: s.format_id as string,
      title: s.title ? `${s.title} (copy)` : "Untitled (copy)",
      sections: (s.sections ?? []) as Json,
      brief_snapshot: (s.brief_snapshot ?? null) as Json | null,
      preset_id: (s.preset_id ?? null) as string | null,
      voice_id: (s.voice_id ?? null) as string | null,
      domain: (s.domain ?? null) as string | null,
      audience: (s.audience ?? null) as string | null,
      workspace_id: (s.workspace_id ?? null) as string | null,
      workspace_item_id: (s.workspace_item_id ?? null) as string | null,
      platform: (s.platform ?? null) as string | null,
      status: "draft" as const,
      archived: false,
    };
    const { data: dup, error: e2 } = await context.supabase
      .from("create_drafts")
      .insert(insertRow)
      .select("id")
      .single();
    if (e2) throw e2;
    return { id: dup.id };
  });

export const moveDraftToWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      workspaceId: z.string().uuid().nullable(),
      workspaceItemId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ workspace_id: data.workspaceId, workspace_item_id: data.workspaceItemId ?? null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const moveDraftToCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), campaignId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ campaign_id: data.campaignId })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Update context pills (voice/preset/knowledge) ------------------

export const updateDraftContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      presetId: z.string().uuid().nullable().optional(),
      voiceId: z.string().uuid().nullable().optional(),
      platform: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      preset_id?: string | null;
      voice_id?: string | null;
      platform?: string | null;
    } = {};
    if (data.presetId !== undefined) patch.preset_id = data.presetId;
    if (data.voiceId !== undefined) patch.voice_id = data.voiceId;
    if (data.platform !== undefined) patch.platform = data.platform;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("create_drafts")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Schedule -------------------------------------------------------

export const scheduleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      draftId: z.string().uuid(),
      scheduledAt: z.string().datetime(),
      platform: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scheduled_content").insert({
      user_id: context.userId,
      draft_id: data.draftId,
      scheduled_at: data.scheduledAt,
      platform: data.platform,
      status: "pending",
    });
    if (error) throw error;
    await context.supabase
      .from("create_drafts")
      .update({ scheduled_date: data.scheduledAt, platform: data.platform, status: "ready" })
      .eq("id", data.draftId)
      .eq("user_id", context.userId);
    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
    await writeEdgeServer(context.supabase, context.userId, {
      srcType: "you",
      srcId: context.userId,
      edgeKind: "SCHEDULED_TO",
      dstType: "draft",
      dstId: data.draftId,
      meta: { platform: data.platform, scheduled_at: data.scheduledAt },
    });
    return { ok: true };
  });

// -------- Per-draft images ----------------------------------------------

export const listDraftImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("create_media")
      .select("id, url, role, generated_by, aspect_ratio, prompt, style_id, parent_image_id, sort_order, created_at")
      .eq("draft_id", data.draftId)
      .eq("user_id", context.userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

const AttachInput = z.object({
  draftId: z.string().uuid(),
  role: z.enum(["cover", "social", "inline"]).default("cover"),
  url: z.string().min(1),
  prompt: z.string().nullable().optional(),
  styleId: z.string().nullable().optional(),
  aspectRatio: z.string().nullable().optional(),
  parentImageId: z.string().uuid().nullable().optional(),
  generatedBy: z.enum(["gpt-image-2", "gemini", "upload", "library"]).default("gemini"),
});

export const attachDraftImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AttachInput.parse(input))
  .handler(async ({ data, context }) => {
    // sort_order = current count for that role.
    const { count } = await context.supabase
      .from("create_media")
      .select("id", { count: "exact", head: true })
      .eq("draft_id", data.draftId)
      .eq("role", data.role);
    const { data: row, error } = await context.supabase
      .from("create_media")
      .insert({
        user_id: context.userId,
        draft_id: data.draftId,
        kind: "image",
        provider: data.generatedBy,
        generated_by: data.generatedBy,
        url: data.url,
        role: data.role,
        prompt: data.prompt ?? null,
        style_id: data.styleId ?? null,
        aspect_ratio: data.aspectRatio ?? null,
        parent_image_id: data.parentImageId ?? null,
        sort_order: count ?? 0,
        meta: {} as Json,
      })
      .select("id")
      .single();
    if (error) throw error;

    const { writeEdgesServer } = await import("@/lib/ai/provenance.server");
    type Edge = import("@/lib/ai/provenance.server").ServerEdgeInput;
    const edges: Edge[] = [
      {
        srcType: "draft",
        srcId: data.draftId,
        edgeKind: "REFERENCES",
        dstType: "image",
        dstId: row.id,
        meta: { role: data.role },
      },
      {
        srcType: "you",
        srcId: context.userId,
        edgeKind: "GENERATED_BY_TOOL",
        dstType: "image",
        dstId: row.id,
        meta: { tool: data.generatedBy, style: data.styleId, prompt: data.prompt?.slice(0, 500) },
      },
    ];
    if (data.parentImageId) {
      edges.push({
        srcType: "image",
        srcId: row.id,
        edgeKind: "REGENERATED_FROM",
        dstType: "image",
        dstId: data.parentImageId,
        meta: {},
      });
    }
    await writeEdgesServer(context.supabase, context.userId, edges);
    return { id: row.id };
  });

export const removeDraftImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_media")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Image concepts (grounded) --------------------------------------

export const generateImageConcepts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase
      .from("create_drafts")
      .select("id, title, sections, format_id, domain, audience, workspace_id")
      .eq("id", data.draftId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!draft) throw new Error("Draft not found");

    const summary =
      (draft.title ?? "") +
      "\n" +
      (Array.isArray(draft.sections)
        ? (draft.sections as Array<{ heading?: string; body?: string }>)
            .map((s) => `${s.heading ?? ""}\n${s.body ?? ""}`)
            .join("\n")
            .slice(0, 1500)
        : "");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { fallback: true as const, concepts: fallbackConcepts(draft.title ?? "Untitled") };
    }

    const system =
      "You are Eve's visual art director. Propose 4 distinct cover-image concepts for a piece of written content. " +
      'Return ONLY JSON: {"concepts":[{"prompt":string,"style":string,"aspect":"1:1"|"16:9"|"9:16","rationale":string}]}';

    const prompt = [
      `[DOMAIN] ${draft.domain ?? "general"}`,
      `[AUDIENCE] ${draft.audience ?? "general"}`,
      `[FORMAT] ${draft.format_id}`,
      `[DRAFT_SUMMARY]\n${summary}`,
      "",
      "Return the JSON only — no prose, no code fences.",
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return { fallback: true as const, concepts: fallbackConcepts(draft.title ?? "Untitled") };
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content ?? "";
      const parsed = safeParseJson(text);
      const concepts = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
      const clean = concepts
        .map((c: unknown) => {
          const o = c as Record<string, unknown>;
          if (typeof o.prompt !== "string") return null;
          return {
            prompt: o.prompt,
            style: typeof o.style === "string" ? o.style : "editorial",
            aspect: typeof o.aspect === "string" ? o.aspect : "16:9",
            rationale: typeof o.rationale === "string" ? o.rationale : "",
          };
        })
        .filter((v: unknown): v is { prompt: string; style: string; aspect: string; rationale: string } => v !== null)
        .slice(0, 6);
      if (clean.length === 0) return { fallback: true as const, concepts: fallbackConcepts(draft.title ?? "Untitled") };
      return { fallback: false as const, concepts: clean };
    } catch {
      return { fallback: true as const, concepts: fallbackConcepts(draft.title ?? "Untitled") };
    }
  });

// -------- Regenerate / polish (extends injection with DRAFT_HISTORY) -----

export const polishDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), instruction: z.string().default("Polish for clarity and voice.") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: draft, error } = await context.supabase
      .from("create_drafts")
      .select("id, format_id, title, sections, brief_snapshot, domain, audience, workspace_id, workspace_item_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!draft) throw new Error("Draft not found");

    const { CREATE_FORMATS } = await import("@/config/createFormats");
    const format = CREATE_FORMATS.find((f) => f.id === draft.format_id);
    if (!format) throw new Error("Unknown format");
    const { formatRules } = await import("@/lib/create/format-rules");
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");

    const currentBody = Array.isArray(draft.sections)
      ? (draft.sections as Array<{ heading?: string; body?: string }>)
          .map((s) => `${s.heading ? `## ${s.heading}\n` : ""}${s.body ?? ""}`)
          .join("\n\n")
      : "";

    const prompt = [
      `[DOMAIN]\n${draft.domain ?? "general"}`,
      `[DRAFT_HISTORY]\n${currentBody.slice(0, 4000)}`,
      `[FORMAT_RULES]\n${formatRules(format)}`,
      `[TASK]\n${data.instruction}\n\nReturn the full revised piece in the same format.`,
    ].join("\n\n");

    const { text } = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      system: "You are Eve. Polish without breaking format or introducing new claims.",
      prompt,
    });

    // Snapshot old sections into version history.
    await context.supabase.from("create_version_history").insert({
      user_id: context.userId,
      draft_id: data.id,
      format_id: draft.format_id,
      sections: draft.sections as Json,
      reason: data.instruction.slice(0, 200),
    });

    // Persist new sections.
    const newSections = splitPolished(text);
    await context.supabase
      .from("create_drafts")
      .update({ sections: newSections as unknown as Json })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
    await writeEdgeServer(context.supabase, context.userId, {
      srcType: "draft",
      srcId: data.id,
      edgeKind: "REGENERATED_FROM",
      dstType: "draft",
      dstId: data.id,
      meta: { instruction: data.instruction.slice(0, 200) },
    });

    return { ok: true, sections: newSections };
  });

// -------- Helpers --------------------------------------------------------

function safeParseJson(s: string): { [k: string]: unknown } | null {
  try {
    const cleaned = s.replace(/^```json\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function fallbackConcepts(title: string) {
  return [
    { prompt: `Editorial cover for "${title}", minimal typography, soft gradient background`, style: "editorial", aspect: "16:9", rationale: "Clean and shareable." },
    { prompt: `Abstract concept art evoking "${title}", muted palette, cinematic light`, style: "abstract", aspect: "16:9", rationale: "Evocative, brand-safe." },
    { prompt: `Documentary photograph capturing the essence of "${title}", natural light`, style: "photo", aspect: "1:1", rationale: "Grounded and human." },
    { prompt: `Bold vector illustration of "${title}", flat shapes, high contrast`, style: "illustration", aspect: "1:1", rationale: "Iconic thumbnail." },
  ];
}

function splitPolished(body: string): Array<{ heading: string | null; body: string }> {
  const parts = body.split(/^\s*#{1,2}\s+/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [{ heading: null, body: body.trim() }];
  return parts.map((p) => {
    const [firstLine, ...rest] = p.split("\n");
    return { heading: firstLine.trim(), body: rest.join("\n").trim() };
  });
}
