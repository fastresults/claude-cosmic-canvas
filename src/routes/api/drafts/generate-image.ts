/**
 * Streaming image generation for drafts.
 * Pass-through SSE from Lovable AI Gateway (Gemini image). No transformation.
 */
import { createFileRoute } from "@tanstack/react-router";

const IMAGE_ROUTE_TIMEOUT_MS = 120_000;
const ALLOWED_ASPECTS = new Set(["1:1", "16:9", "9:16", "4:5", "3:4"]);

export const Route = createFileRoute("/api/drafts/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        let body: { prompt?: string; aspect?: string; negativePrompt?: string } = {};
        try {
          body = (await request.json()) as { prompt?: string; aspect?: string; negativePrompt?: string };
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });
        if (prompt.length > 4000) return new Response("Prompt is too long", { status: 400 });
        const requestedAspect = (body.aspect ?? "16:9").trim();
        const aspect = ALLOWED_ASPECTS.has(requestedAspect) ? requestedAspect : "16:9";
        const negative = (body.negativePrompt ?? "").trim();

        const { createClient } = await import("@supabase/supabase-js");
        const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });

        const composed =
          `${prompt}\n\n[ASPECT_RATIO] ${aspect}` +
          (negative ? `\n[NEGATIVE] ${negative}` : "");

        console.info("[draft-image] stream:start", {
          aspect,
          promptLength: prompt.length,
          hasNegative: Boolean(negative),
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), IMAGE_ROUTE_TIMEOUT_MS);
        let upstream: Response;
        try {
          const { gatewayFetch } = await import("@/lib/ai/gateway.server");
          upstream = await gatewayFetch("/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              model: "google/gemini-3-pro-image",
              messages: [{ role: "user", content: composed }],
              modalities: ["image", "text"],
              stream: true,
            }),
          });
        } catch (error) {
          clearTimeout(timeoutId);
          const timedOut = controller.signal.aborted;
          const message = error instanceof Error ? error.message : "Image generation failed";
          console.error("[draft-image] stream:failed", {
            timedOut,
            message: message.slice(0, 240),
          });
          return new Response(timedOut ? "Image generation timed out" : message, {
            status: timedOut ? 504 : 502,
          });
        }

        if (!upstream.body) {
          clearTimeout(timeoutId);
          console.error("[draft-image] stream:empty_body", { status: upstream.status });
          return new Response("Image stream did not start", { status: 502 });
        }
        clearTimeout(timeoutId);
        console.info("[draft-image] stream:upstream_ready", { status: upstream.status });
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
