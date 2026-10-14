/**
 * Streaming draft generation for the Create page.
 * Emits NDJSON lines: {type:"delta",text} while writing, then {type:"done",result}
 * or {type:"error",message}. Same pipeline as generateCreateDraft.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Input = z.object({
  formatId: z.string().min(1),
  seed: z.string().min(1),
  draftId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  workspaceItemId: z.string().uuid().nullable().optional(),
  channels: z.array(z.string()).max(6).optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

export const Route = createFileRoute("/api/drafts/generate-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = Input.safeParse(raw);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: authData, error: authError } = await sb.auth.getUser(token);
        if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });

        try {
          const { enforceRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit/rate-limit.server");
          await enforceRateLimit(sb, RATE_LIMITS.ai_generate);
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Too many requests", { status: 429 });
        }

        const encoder = new TextEncoder();
        const userId = authData.user.id;
        const stream = new ReadableStream({
          async start(controller) {
            const send = (obj: unknown) => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
              } catch {
                /* client went away */
              }
            };
            try {
              const { runGenerateCreateDraft } = await import("@/lib/create/create.server");
              const result = await runGenerateCreateDraft(parsed.data, {
                supabase: sb,
                userId,
                onTextDelta: (text) => send({ type: "delta", text }),
              });
              send({ type: "done", result });
            } catch (e) {
              send({ type: "error", message: e instanceof Error ? e.message : "Generation failed" });
            } finally {
              controller.close();
            }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
