// Library search + filter + bulk actions.
// Single endpoint powers keyword FTS, structured filters, sort, and cursor pagination.
import { createServerFn } from "@tanstack/react-start";
import { aiRateLimit } from "@/lib/rate-limit/ai-rate-limit";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FiltersSchema = z.object({
  formats: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  dateFrom: z.string().optional(), // ISO
  dateTo: z.string().optional(),
});

const SearchInput = z.object({
  q: z.string().optional(),
  filters: FiltersSchema.optional(),
  sort: z.enum(["recent", "oldest", "score"]).default("recent"),
  // Library partition: general = personal library (no milestone),
  // milestone = items attached to any milestone workspace,
  // all = unfiltered (admin/debug only).
  scope: z.enum(["general", "milestone", "all"]).default("general"),
  workspaceId: z.string().uuid().nullable().optional(),
  cursor: z.string().nullable().optional(),
  limit: z.number().min(1).max(60).default(30),
});

export type LibraryFilters = z.infer<typeof FiltersSchema>;
export type LibrarySort = "recent" | "oldest" | "score";

function encodeCursor(row: { created_at: string; id: string }) {
  return Buffer.from(JSON.stringify({ c: row.created_at, i: row.id })).toString(
    "base64",
  );
}
function decodeCursor(cursor: string): { c: string; i: string } | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export const searchDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("create_drafts")
      .select(
        "id, format_id, title, sections, quality_score, status, created_at, campaign_id, workspace_id",
      )
      .eq("user_id", context.userId);

    // Partition: General = no milestone; Milestone = attached to a workspace.
    if (data.scope === "general") {
      query = query.is("workspace_id", null);
    } else if (data.scope === "milestone") {
      if (data.workspaceId) query = query.eq("workspace_id", data.workspaceId);
      else query = query.not("workspace_id", "is", null);
    }

    const q = data.q?.trim();
    if (q && q.length > 0) {
      // Title match OR body-in-sections match (jsonb ->> 0 -> 'body')
      const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(`title.ilike.${like},sections->0->>body.ilike.${like}`);
    }

    const f = data.filters ?? {};
    if (f.formats && f.formats.length > 0) query = query.in("format_id", f.formats);
    if (f.statuses && f.statuses.length > 0) query = query.in("status", f.statuses);
    if (f.campaignId !== undefined) {
      if (f.campaignId === null) query = query.is("campaign_id", null);
      else query = query.eq("campaign_id", f.campaignId);
    }
    if (f.dateFrom) query = query.gte("created_at", f.dateFrom);
    if (f.dateTo) query = query.lte("created_at", f.dateTo);

    const cursor = data.cursor ? decodeCursor(data.cursor) : null;
    if (data.sort === "oldest") {
      if (cursor) {
        query = query.or(
          `created_at.gt.${cursor.c},and(created_at.eq.${cursor.c},id.gt.${cursor.i})`,
        );
      }
      query = query
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
    } else {
      if (cursor && data.sort === "recent") {
        query = query.or(
          `created_at.lt.${cursor.c},and(created_at.eq.${cursor.c},id.lt.${cursor.i})`,
        );
      }
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    }

    query = query.limit(data.limit + 1);

    const { data: rows, error } = await query;
    if (error) throw error;
    const raw = rows ?? [];
    const hasMore = raw.length > data.limit;
    const page = hasMore ? raw.slice(0, data.limit) : raw;

    // Batch-fetch cover thumbnails
    const ids = page.map((r) => r.id);
    const covers: Record<string, string | null> = {};
    if (ids.length) {
      const { data: media } = await supabase
        .from("create_media")
        .select("draft_id, url, role, sort_order")
        .in("draft_id", ids)
        .order("sort_order", { ascending: true });
      for (const m of media ?? []) {
        if (!m.draft_id) continue;
        if (!covers[m.draft_id] && (m.role === "cover" || m.role == null)) {
          covers[m.draft_id] = m.url;
        }
      }
    }

    // Fetch workspace titles for any milestone-attached rows on this page.
    const wsIds = Array.from(
      new Set(page.map((r) => r.workspace_id).filter((x): x is string => !!x)),
    );
    const wsTitles: Record<string, string> = {};
    if (wsIds.length) {
      const { data: wss } = await supabase
        .from("opportunity_workspaces")
        .select("id, title")
        .in("id", wsIds);
      for (const w of wss ?? []) wsTitles[w.id] = w.title ?? "Milestone";
    }

    // Adapt to legacy Library row shape used by the UI
    const items = page.map((r) => {
      const sections = Array.isArray(r.sections) ? r.sections : [];
      const first = (sections[0] ?? {}) as { heading?: string | null; body?: string };
      const bodyText = first.body ?? "";
      const displayTitle = r.title?.trim() ? r.title.trim() : null;
      return {
        id: r.id,
        format: r.format_id ?? "post",
        title: displayTitle,
        body: displayTitle ? bodyText : bodyText || r.title || "",
        score: r.quality_score != null ? { total: Number(r.quality_score) } : {},
        status: r.status ?? "draft",
        image_url: covers[r.id] ?? null,
        created_at: r.created_at,
        campaign_id: r.campaign_id,
        workspace_id: r.workspace_id ?? null,
        workspace_title: r.workspace_id ? wsTitles[r.workspace_id] ?? null : null,
      };
    });

    const nextCursor = hasMore
      ? encodeCursor(page[page.length - 1] as { created_at: string; id: string })
      : null;

    return { items, nextCursor };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

const NLQ = z.object({ utterance: z.string().min(1) });

export const parseLibraryQuery = createServerFn({ method: "POST" })
  .middleware([aiRateLimit])
  .inputValidator((input: unknown) => NLQ.parse(input))
  .handler(async ({ data }) => {
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL } = await import("@/lib/orchestrator/config");

    const system = [
      "You translate a user's natural-language library search into JSON.",
      "Allowed formats: post, thread, essay, reply, tweet, email, other.",
      "Allowed statuses: draft, scheduled, posted, archived.",
      "Return STRICT JSON only, no prose, matching this shape:",
      `{"q": string|null, "filters": {"formats": string[]|null, "statuses": string[]|null, "dateFrom": string|null, "dateTo": string|null}}`,
      "dateFrom/dateTo are ISO-8601 timestamps if the user mentioned a time window; otherwise null.",
      "Put remaining topical keywords into q. If nothing structured, put the whole utterance in q.",
      `Today is ${new Date().toISOString()}.`,
    ].join("\n");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: 400,
      prompt: data.utterance,
      system,
    });

    let parsed: {
      q: string | null;
      filters: {
        formats: string[] | null;
        statuses: string[] | null;
        dateFrom: string | null;
        dateTo: string | null;
      };
    } | null = null;
    try {
      const cleaned = result.text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return {
        q: data.utterance,
        filters: {
          formats: null,
          statuses: null,
          dateFrom: null,
          dateTo: null,
        },
      };
    }
    return parsed;
  });

const BulkIds = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

export const bulkDeleteDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkIds.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .delete()
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true, count: data.ids.length };
  });

const BulkStatus = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(["draft", "scheduled", "posted", "archived"]),
});

export const bulkSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkStatus.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ status: data.status })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });

const BulkCampaign = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  campaignId: z.string().uuid().nullable(),
});

export const bulkAssignCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkCampaign.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("create_drafts")
      .update({ campaign_id: data.campaignId })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });
