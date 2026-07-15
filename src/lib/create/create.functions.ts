/**
 * /create hub — draft CRUD + generation server functions.
 * All handlers auth-gated. Generation writes a Brain provenance edge.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const GenerateInput = z.object({
  formatId: z.string().min(1),
  seed: z.string().min(1),
  draftId: z.string().uuid().optional(),
  presetId: z.string().uuid().optional(),
  voiceId: z.string().uuid().optional(),
  briefOverrides: z.record(z.string(), z.unknown()).optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  workspaceItemId: z.string().uuid().nullable().optional(),
  // User-provided draft name. Required to persist a NEW draft; ignored on updates
  // (rename goes through `renameDraft`).
  title: z.string().trim().min(1).max(120).optional(),
});

const SaveInput = z.object({
  draftId: z.string().uuid().optional(),
  formatId: z.string().min(1),
  title: z.string().trim().min(1, "Please name your draft.").max(120),
  sections: z.array(z.unknown()),
  briefSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(["draft", "ready", "archived"]).default("draft"),
  workspaceId: z.string().uuid().nullable().optional(),
  workspaceItemId: z.string().uuid().nullable().optional(),
});


const IdInput = z.object({ id: z.string().uuid() });
const ListInput = z.object({
  formatId: z.string().optional(),
  includeArchived: z.boolean().default(false),
  workspaceId: z.string().uuid().nullable().optional(),
  excludeWorkspaceScoped: z.boolean().default(true),
}).default({ includeArchived: false, excludeWorkspaceScoped: true });

/** List the user's create_drafts (optionally filtered by format). */
export const listCreateDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("create_drafts")
      .select("id, format_id, title, sections, status, archived, quality_score, updated_at, created_at, workspace_id, workspace_item_id")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (data.formatId) q = q.eq("format_id", data.formatId);
    if (!data.includeArchived) q = q.eq("archived", false);
    if (data.workspaceId) {
      q = q.eq("workspace_id", data.workspaceId);
    } else if (data.excludeWorkspaceScoped) {
      q = q.is("workspace_id", null);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/** Read a single draft. */
export const getCreateDraft = createServerFn({ method: "POST" })
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
    return row;
  });

/** Upsert a draft (autosave-friendly). */
export const saveCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      format_id: data.formatId,
      title: data.title,
      sections: (data.sections ?? []) as unknown as Json,
      brief_snapshot: (data.briefSnapshot ?? null) as Json | null,
      status: data.status,
      workspace_id: data.workspaceId ?? null,
      workspace_item_id: data.workspaceItemId ?? null,
    };
    if (data.draftId) {
      const { data: row, error } = await context.supabase
        .from("create_drafts")
        .update(payload)
        .eq("id", data.draftId)
        .eq("user_id", context.userId)
        .select("id, updated_at")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("create_drafts")
      .insert(payload)
      .select("id, updated_at")
      .single();
    if (error) throw error;
    return row;
  });

/** Archive (soft) or unarchive a draft. */
export const archiveCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ archived: data.archived, status: data.archived ? "archived" : "draft" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Hard delete a draft (cascades version history via FK). */
export const deleteCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Generate a draft for a format. Non-streaming for reliability (Phase 1);
 * SSE upgrade is a follow-up. Assembles the injection contract:
 * [DOMAIN] → [VOICE] → [KNOWLEDGE] → [PRESET] → [WORKSPACE_CONTEXT] → [FORMAT_RULES] → [TASK]
 * Persists to create_drafts and writes a Brain provenance edge.
 */
export const generateCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertUserDefaults } = await import("@/lib/defaults/assert.server");
    await assertUserDefaults(context.supabase, context.userId);

    const { CREATE_FORMATS, normalizeCreateFormatId } = await import("@/config/createFormats");
    const formatId = normalizeCreateFormatId(data.formatId);
    const format = CREATE_FORMATS.find((f) => f.id === formatId);
    if (!format) {
      return { fallback: true as const, message: `Unknown format: ${data.formatId}`, draftId: null };
    }

    const { formatRules } = await import("./format-rules");
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");

    // Load lightweight context: display name, active persona/voice.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("persona_active_id, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    const personaId: string | null = profile?.persona_active_id ?? null;
    let voiceDirectives: unknown = null;
    if (personaId) {
      const { data: voice } = await context.supabase
        .from("voice_profiles")
        .select("directives")
        .eq("persona_id", personaId)
        .maybeSingle();
      voiceDirectives = voice?.directives ?? null;
    }

    // Optional workspace context.
    let workspaceBlock: string | null = null;
    if (data.workspaceId) {
      const { data: ws } = await context.supabase
        .from("opportunity_workspaces")
        .select("title, moment_type, target_date, ai_analysis")
        .eq("id", data.workspaceId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (ws) {
        const { data: siblings } = await context.supabase
          .from("workspace_items")
          .select("title, phase, status")
          .eq("workspace_id", data.workspaceId)
          .neq("id", data.workspaceItemId ?? "00000000-0000-0000-0000-000000000000")
          .order("sort_order", { ascending: true })
          .limit(20);
        let selfItem: { title: string; phase: string; description: string | null } | null = null;
        if (data.workspaceItemId) {
          const { data: item } = await context.supabase
            .from("workspace_items")
            .select("title, phase, description")
            .eq("id", data.workspaceItemId)
            .maybeSingle();
          selfItem = item ?? null;
        }
        const target = ws.target_date ? new Date(ws.target_date) : null;
        const today = new Date();
        const tOffset = target
          ? Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const tLabel = tOffset === null ? "n/a" : tOffset === 0 ? "T" : tOffset > 0 ? `T+${tOffset}` : `T${tOffset}`;
        const analysis = (ws.ai_analysis ?? {}) as Record<string, unknown>;
        const summary = typeof analysis.summary === "string" ? analysis.summary : JSON.stringify(analysis).slice(0, 400);
        const siblingList = (siblings ?? [])
          .map((s) => `- [${s.phase}] ${s.title}${s.status ? ` (${s.status})` : ""}`)
          .join("\n");
        workspaceBlock = [
          `[WORKSPACE_CONTEXT]`,
          `Milestone: ${ws.title}`,
          `Moment type: ${ws.moment_type}`,
          `Target date: ${ws.target_date ?? "n/a"} (${tLabel})`,
          `Arc phase for this piece: ${selfItem?.phase ?? "ongoing"}`,
          `Arc summary: ${summary}`,
          `Sibling items already scoped:\n${siblingList || "- (none yet)"}`,
          `This piece's role in the arc: ${selfItem?.description ?? selfItem?.title ?? "supporting piece"}`,
          `Reference sibling pieces where useful — do NOT duplicate them.`,
        ].join("\n");
      }
    }

    // Injection contract.
    const blocks: string[] = [];
    blocks.push(`[DOMAIN]\n${personaId ? "Active persona in use." : "General."}`);
    blocks.push(
      voiceDirectives
        ? `[VOICE]\n${JSON.stringify(voiceDirectives).slice(0, 2000)}`
        : `[VOICE]\nWrite as ${profile?.display_name ?? "the user"}; match their cadence.`,
    );
    blocks.push(`[KNOWLEDGE]\n(No matching reference material was pre-fetched for this call.)`);
    blocks.push(`[PRESET]\n${JSON.stringify(data.briefOverrides ?? {})}`);
    if (workspaceBlock) blocks.push(workspaceBlock);
    blocks.push(`[FORMAT_RULES]\n${formatRules(format)}`);
    blocks.push(`[TASK]\n${data.seed}`);

    console.log(
      "[create.generate] injection order:",
      blocks.map((b) => b.split("\n", 1)[0]).join(" → "),
    );

    const system = [
      "You are Eve, an on-brand ghostwriter.",
      "Ground every factual claim in [KNOWLEDGE]. If a claim cannot be supported, omit it. Never fabricate roles, companies, dates, or numbers.",
      "Priority when signals conflict: Topic > Domain > Voice > Knowledge.",
    ].join("\n");

    let bodyText = "";
    let usage: unknown = null;
    try {
      const result = await callAnthropic({
        model: ORCHESTRATOR_MODEL,
        maxTokens: MAX_TOKENS,
        prompt: blocks.join("\n\n"),
        system,
      });
      bodyText = result.text.trim();
      usage = result.usage;
    } catch (err) {
      // Graceful fallback per spec — return 200 with fallback shape.
      const message = err instanceof Error ? err.message : "Generation failed";
      return { fallback: true as const, message, draftId: null };
    }

    const sections = splitSections(bodyText, format.id);
    const title = deriveTitle(bodyText, data.seed);

    // Upsert draft.
    const payload = {
      user_id: context.userId,
      format_id: format.id,
      title,
      sections: sections as unknown as Json,
      brief_snapshot: (data.briefOverrides ?? null) as Json | null,
      preset_id: data.presetId ?? null,
      voice_id: data.voiceId ?? null,
      status: "draft" as const,
      workspace_id: data.workspaceId ?? null,
      workspace_item_id: data.workspaceItemId ?? null,
    };

    let draftId = data.draftId ?? null;
    if (draftId) {
      const { error } = await context.supabase
        .from("create_drafts")
        .update(payload)
        .eq("id", draftId)
        .eq("user_id", context.userId);
      if (error) throw error;
    } else {
      const { data: row, error } = await context.supabase
        .from("create_drafts")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      draftId = row.id;
    }

    // Brain provenance edge.
    if (draftId) {
      await writeEdgeServer(context.supabase, context.userId, {
        srcType: "you",
        srcId: context.userId,
        edgeKind: "GENERATED_BY_TOOL",
        dstType: "draft",
        dstId: draftId,
        meta: {
          tool: "claude",
          model: ORCHESTRATOR_MODEL,
          format: format.id,
          seed: data.seed.slice(0, 500),
          usage,
          workspace_id: data.workspaceId ?? null,
          workspace_item_id: data.workspaceItemId ?? null,
        },
      });

      // Bump the workspace item to `ready` once we've generated for it.
      if (data.workspaceItemId) {
        await context.supabase
          .from("workspace_items")
          .update({ status: "ready", content_generation_id: draftId })
          .eq("id", data.workspaceItemId);
      }
    }

    return { fallback: false as const, draftId, title, sections };
  });

function splitSections(body: string, formatId: string): Array<{ heading: string | null; body: string }> {
  const sep = formatId === "email-sequence" ? /---EMAIL---/i
    : formatId === "newsletter-sequence" ? /---ISSUE---/i
    : null;
  if (sep) {
    return body
      .split(sep)
      .map((s, i) => ({ heading: `Part ${i + 1}`, body: s.trim() }))
      .filter((s) => s.body.length > 0);
  }
  // Split on markdown H2/H1 headers.
  const parts = body.split(/^\s*#{1,2}\s+/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [{ heading: null, body: body.trim() }];
  return parts.map((p) => {
    const [firstLine, ...rest] = p.split("\n");
    return { heading: firstLine.trim(), body: rest.join("\n").trim() };
  });
}

function deriveTitle(body: string, seed: string): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  const stripped = firstLine.replace(/^#+\s*/, "").replace(/^["'*]+|["'*]+$/g, "");
  if (stripped.length > 0 && stripped.length <= 120) return stripped;
  return seed.slice(0, 80);
}
