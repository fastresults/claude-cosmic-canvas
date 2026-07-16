// Orchestrator tool registry. Each tool is a thin AI SDK `tool()` wrapper over
// an existing server-side helper — no business logic lives here. Tools are
// bound per-request so they can capture the authenticated Supabase client
// from requireSupabaseAuth middleware.
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ToolBindingContext = {
  supabase: SupabaseClient<any>;
  userId: string;
};

export function buildOrchestratorTools(ctx: ToolBindingContext) {
  return {
    brain_search: tool({
      description:
        "Search the user's Second Brain for knowledge entries matching a natural-language query. Returns titles + short summaries.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).default(6),
      }),
      execute: async ({ query, limit }) => {
        const needle = query.toLowerCase();
        const { data, error } = await ctx.supabase
          .from("knowledge_entries")
          .select("id, title, summary, tags")
          .eq("user_id", ctx.userId)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(40);
        if (error) return { results: [], error: error.message };

        const scored = (data ?? [])
          .map((e) => {
            const hay = `${e.title ?? ""} ${(e.tags ?? []).join(" ")} ${(e.summary ?? "").slice(0, 400)}`.toLowerCase();
            let score = 0;
            for (const tok of needle.split(/\s+/).filter((t) => t.length > 3)) {
              if (hay.includes(tok)) score += 1;
            }
            return { entry: e, score };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((x) => ({
            id: x.entry.id,
            title: x.entry.title ?? "Untitled",
            summary: (x.entry.summary ?? "").slice(0, 400),
          }));

        return { results: scored };
      },
    }),

    list_drafts: tool({
      description:
        "List the user's most recent drafts. Use before drafting to avoid duplicates.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ limit }) => {
        const { data, error } = await ctx.supabase
          .from("drafts")
          .select("id, title, status, format_id, channel_id, updated_at")
          .eq("user_id", ctx.userId)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) return { drafts: [], error: error.message };
        return { drafts: data ?? [] };
      },
    }),

    // ------------------ Milestone pipeline tools ---------------------------

    list_workspace_items: tool({
      description:
        "List items in a milestone workspace with status and scheduling info. Use to plan and iterate over pending work.",
      inputSchema: z.object({
        workspace_id: z.string().uuid(),
        only_pending: z.boolean().default(false),
      }),
      execute: async ({ workspace_id, only_pending }) => {
        const { data, error } = await ctx.supabase
          .from("workspace_items")
          .select(
            "id, title, description, content_type, channels, phase, status, release_status, scheduled_date, content_generation_id, sort_order",
          )
          .eq("workspace_id", workspace_id)
          .order("sort_order", { ascending: true });
        if (error) return { items: [], error: error.message };
        const items = (data ?? []).filter((i) =>
          only_pending ? !i.content_generation_id : true,
        );
        return { items };
      },
    }),

    draft_workspace_item: tool({
      description:
        "Draft (or regenerate) the copy for a single milestone workspace item. Uses the item's brief, channels, and the milestone context to produce a channel-native draft in the user's voice, persists it, and links it to the item.",
      inputSchema: z.object({
        workspace_item_id: z.string().uuid(),
      }),
      execute: async ({ workspace_item_id }) => {
        const { data: item, error: iErr } = await ctx.supabase
          .from("workspace_items")
          .select(
            "id, title, description, content_type, channels, workspace_id, content_generation_id",
          )
          .eq("id", workspace_item_id)
          .maybeSingle();
        if (iErr) return { ok: false, error: iErr.message };
        if (!item) return { ok: false, error: "item not found" };

        const { normalizeCreateFormatId } = await import("@/config/createFormats");
        const { CHANNEL_SPECS } = await import("@/lib/workspaces/channelSpecs");
        const { runGenerateCreateDraft } = await import("@/lib/create/create.server");

        const primary = item.channels?.[0] as keyof typeof CHANNEL_SPECS | undefined;
        const spec = primary ? CHANNEL_SPECS[primary] : undefined;
        const channelLine = spec
          ? `Write native to ${spec.label}. Structure: ${spec.structure}. Ideal length ${spec.ideal_chars[0]}–${spec.ideal_chars[1]} chars, hard max ${spec.max_chars}. Hook: ${spec.hook_style}. CTA: ${spec.cta_style}. Hashtags: ${spec.hashtag_policy}. Tone: ${spec.tone_hint}.`
          : "Write in the user's voice; no channel constraints supplied.";
        const seed = [
          item.title,
          item.description ?? "",
          "",
          channelLine,
          "This piece is part of a coordinated milestone arc — refer to sibling pieces already in the workspace context without duplicating them. Elevate the user's authority and personal brand.",
        ]
          .filter(Boolean)
          .join("\n\n");

        const result = await runGenerateCreateDraft(
          {
            formatId: normalizeCreateFormatId(item.content_type),
            seed,
            workspaceId: item.workspace_id,
            workspaceItemId: item.id,
            channels: (item.channels ?? []) as string[],
            draftId: item.content_generation_id ?? undefined,
            title: item.title,
          },
          ctx,
        );

        if (result.fallback) return { ok: false, error: result.message };
        return {
          ok: true,
          draft_id: "draftId" in result ? result.draftId : null,
          title: "title" in result ? result.title : null,
        };
      },
    }),

    schedule_workspace_item: tool({
      description:
        "Schedule a milestone workspace item into the release queue. Requires the item to already have a drafted content_generation and either a scheduled_date on the item or an explicit scheduled_at.",
      inputSchema: z.object({
        workspace_item_id: z.string().uuid(),
        scheduled_at: z.string().datetime().optional(),
      }),
      execute: async ({ workspace_item_id, scheduled_at }) => {
        const { runScheduleWorkspaceItem } = await import("@/lib/workspaces/pipeline.server");
        const res = await runScheduleWorkspaceItem(
          { workspace_item_id, scheduled_at },
          ctx,
        );
        return res;
      },
    }),

    workspace_progress: tool({
      description:
        "Get progress snapshot for a milestone workspace: total items, drafted, scheduled, pending ids.",
      inputSchema: z.object({
        workspace_id: z.string().uuid(),
      }),
      execute: async ({ workspace_id }) => {
        const { data, error } = await ctx.supabase
          .from("workspace_items")
          .select("id, content_generation_id, release_status")
          .eq("workspace_id", workspace_id);
        if (error) return { error: error.message };
        const rows = data ?? [];
        return {
          total: rows.length,
          drafted: rows.filter((r) => !!r.content_generation_id).length,
          scheduled: rows.filter(
            (r) => r.release_status === "scheduled" || r.release_status === "awaiting_approval",
          ).length,
          pending: rows.filter((r) => !r.content_generation_id).map((r) => r.id),
        };
      },
    }),
  };
}

export type OrchestratorToolSet = ReturnType<typeof buildOrchestratorTools>;
