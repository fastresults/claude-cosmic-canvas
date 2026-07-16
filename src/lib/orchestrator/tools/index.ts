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

/**
 * Build the tool set for one orchestrated run. Starts small and grows as
 * more surfaces migrate onto the orchestrator (see .lovable/plan.md §3).
 */
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
  };
}

export type OrchestratorToolSet = ReturnType<typeof buildOrchestratorTools>;
