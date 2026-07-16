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
  // Channel selection for channel-native formats (Social Post). Ignored for others.
  channels: z.array(z.string()).max(6).optional(),
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
    const { runGenerateCreateDraft } = await import("./create.server");
    return runGenerateCreateDraft(data, {
      supabase: context.supabase,
      userId: context.userId,
    });
  });




// ---------- AI title suggestion --------------------------------------------

const SectionShape = z.object({
  heading: z.string().nullable().optional(),
  body: z.string().optional(),
});

const SuggestTitleInput = z.union([
  z.object({ draftId: z.string().uuid() }),
  z.object({ sections: z.array(SectionShape).min(1) }),
]);

function cleanSuggestedTitle(raw: string): string {
  let t = (raw ?? "").trim();
  // Strip code fences.
  t = t.replace(/^```[a-z]*\s*|\s*```$/gi, "");
  // Strip common preambles like "Title:" or "Here's a title:".
  t = t.replace(/^(?:here(?:'s| is)?(?: a)?(?: suggested)?(?: draft)? title[:\-–]?\s*)/i, "");
  t = t.replace(/^title[:\-–]\s*/i, "");
  // Take the first non-empty line.
  const firstLine = t.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  t = firstLine;
  // Strip surrounding quotes / markdown / trailing punctuation.
  t = t.replace(/^["'`*_\s]+|["'`*_.!?,;:\s]+$/g, "");
  // Collapse whitespace and cap to 7 whole words — never slice mid-word so
  // the title always reads as a complete, grammatical phrase.
  t = t.replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean).slice(0, 7);
  t = words.join(" ");
  return t;
}

export const suggestDraftTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestTitleInput.parse(input))
  .handler(async ({ data, context }) => {
    let sections: Array<{ heading?: string | null; body?: string }> = [];
    if ("draftId" in data) {
      const { data: row, error } = await context.supabase
        .from("create_drafts")
        .select("sections")
        .eq("id", data.draftId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error("Draft not found");
      sections = (Array.isArray(row.sections) ? row.sections : []) as typeof sections;
    } else {
      sections = data.sections as typeof sections;
    }

    const body = sections
      .map((s) => [s.heading ?? "", s.body ?? ""].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    if (!body.length) throw new Error("Nothing to summarize yet — generate content first.");

    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL } = await import("@/lib/orchestrator/config");

    const system = [
      "You are a senior copywriter naming a piece of content.",
      "Return ONLY the title text — no quotes, no markdown, no preamble, no trailing punctuation.",
      "Requirements: 3 to 7 words, Title Case, a complete grammatical phrase that reads cleanly to a general audience,",
      "capture the piece's core point, no clickbait, no emojis, no colons, no ellipses, no cut-off fragments.",
    ].join(" ");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: 200,
      system,
      prompt: `Draft content:\n\n${body}\n\nWrite ONE complete title of 3–7 words. Output only the title.`,
    });

    let title = cleanSuggestedTitle(result.text);
    if (!title.length) {
      // Fallback: use first meaningful words of the content itself so the user
      // always gets an editable suggestion rather than a hard error.
      title = cleanSuggestedTitle(body);
    }
    if (!title.length) throw new Error("Could not produce a title — please name it manually.");
    return { title };
  });

