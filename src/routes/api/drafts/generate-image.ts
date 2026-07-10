/**
 * Streaming image generation for drafts.
 * Pass-through SSE from Lovable AI Gateway (Gemini image). No transformation.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/drafts/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        let body: { prompt?: string; aspect?: string } = {};
        try {
          body = (await request.json()) as { prompt?: string; aspect?: string };
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Missing prompt", { status: 400 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          return new Response(t || "Upstream error", { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
