/**
 * Streaming image generation for drafts.
 * Pass-through SSE from Lovable AI Gateway (Gemini image). No transformation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const IMAGE_ROUTE_TIMEOUT_MS = 120_000;
const ALLOWED_ASPECTS = new Set(["1:1", "16:9", "9:16", "4:5", "3:4"]);

const GenerateImageInput = z.object({
  draftId: z.string().uuid(),
  role: z.enum(["cover", "social", "inline"]),
  styleId: z.string().nullable().optional(),
  conceptPrompt: z.string().max(1200).optional(),
  customDirection: z.string().max(1200).optional(),
  aspect: z.string().optional(),
});

type DraftRow = {
  title: string | null;
  sections: unknown;
  format_id: string;
  domain: string | null;
  audience: string | null;
  platform: string | null;
};

type StyleRow = {
  style_id: string;
  name: string;
  description: string | null;
  prompt_prefix: string;
  negative_prompt: string;
};

function compact(value: string, max = 1800) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function draftText(draft: DraftRow) {
  if (!Array.isArray(draft.sections)) return draft.title ?? "Untitled draft";
  const body = (draft.sections as Array<{ heading?: string | null; body?: string | null }>)
    .map((section) => [section.heading, section.body].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
  return [draft.title, body].filter(Boolean).join("\n\n");
}

function rolePurpose(role: "cover" | "social" | "inline") {
  if (role === "social") {
    return "Create a mobile-first social image that captures the article's core point in a thumb-stopping, square composition. No readable text.";
  }
  if (role === "inline") {
    return "Create an inline supporting image that clarifies one concrete idea from the article without introducing claims the article does not make. No readable text.";
  }
  return "Create a cover image that represents the article's central argument at a glance, suitable as the primary share image. No readable text.";
}

function buildFinalPrompt(input: z.infer<typeof GenerateImageInput>, draft: DraftRow, style: StyleRow | null) {
  const summary = compact(draftText(draft), 1900);
  const direction = compact([input.conceptPrompt, input.customDirection].filter(Boolean).join("\n"), 900);
  const styleBlock = style
    ? [
        `[STYLE_TEMPLATE] ${style.name}`,
        style.description ? `Style intent: ${style.description}` : "",
        `Style instructions: ${style.prompt_prefix}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "[STYLE_TEMPLATE] No explicit style selected. Use a polished editorial visual direction.";
  const finalPrompt = [
    "Generate one image for this exact article. Stay faithful to the article; do not invent unrelated people, products, scenes, numbers, logos, or readable text.",
    `[IMAGE_ROLE] ${input.role}`,
    `[IMAGE_PURPOSE] ${rolePurpose(input.role)}`,
    `[ARTICLE_TITLE] ${draft.title ?? "Untitled draft"}`,
    `[FORMAT] ${draft.format_id}${draft.platform ? ` for ${draft.platform}` : ""}`,
    `[DOMAIN] ${draft.domain ?? "general"}`,
    `[AUDIENCE] ${draft.audience ?? "general"}`,
    `[ARTICLE_CONTEXT]\n${summary}`,
    styleBlock,
    direction ? `[USER_DIRECTION]\n${direction}` : "[USER_DIRECTION]\nUse the article context to choose the strongest visual metaphor.",
    `[ASPECT_RATIO] ${input.aspect}`,
    style?.negative_prompt ? `[NEGATIVE] ${style.negative_prompt}` : "[NEGATIVE] text, watermark, logo, off-topic subject, unrelated stock-photo scene",
  ].join("\n\n");
  return {
    finalPrompt: finalPrompt.slice(0, 3900),
    groundingSummary: summary.slice(0, 500),
  };
}

function metadataEvent(meta: unknown) {
  return `event: draft_image.metadata\ndata: ${JSON.stringify(meta)}\n\n`;
}

export const Route = createFileRoute("/api/drafts/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        const token = authorization.replace(/^Bearer\s+/i, "").trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = GenerateImageInput.safeParse(rawBody);
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const body = parsed.data;
        const requestedAspect = (body.aspect ?? "16:9").trim();
        const aspect = ALLOWED_ASPECTS.has(requestedAspect) ? requestedAspect : "16:9";
        body.aspect = aspect;

        const { createClient } = await import("@supabase/supabase-js");
        const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authError } = await authClient.auth.getUser(token);
        if (authError || !authData.user) return new Response("Unauthorized", { status: 401 });

        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: draft, error: draftError } = await sb
          .from("create_drafts")
          .select("title, sections, format_id, domain, audience, platform")
          .eq("id", body.draftId)
          .eq("user_id", authData.user.id)
          .maybeSingle();
        if (draftError) throw draftError;
        if (!draft) return new Response("Draft not found", { status: 404 });

        let style: StyleRow | null = null;
        if (body.styleId) {
          const { data: styleRow, error: styleError } = await sb
            .from("image_generation_styles")
            .select("style_id, name, description, prompt_prefix, negative_prompt")
            .eq("style_id", body.styleId)
            .eq("is_enabled", true)
            .contains("supported_types", [body.role])
            .maybeSingle();
          if (styleError) throw styleError;
          if (!styleRow) return new Response("Selected style is unavailable", { status: 400 });
          style = styleRow as StyleRow;
        }

        const { finalPrompt, groundingSummary } = buildFinalPrompt(body, draft as DraftRow, style);
        const meta = {
          finalPrompt,
          groundingSummary,
          style: style
            ? {
                styleId: style.style_id,
                name: style.name,
                description: style.description,
                promptPrefix: style.prompt_prefix,
                negativePrompt: style.negative_prompt,
              }
            : null,
        };

        console.info("[draft-image] stream:start", {
          draftId: body.draftId,
          role: body.role,
          aspect,
          styleId: body.styleId ?? null,
          promptLength: finalPrompt.length,
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
              messages: [{ role: "user", content: finalPrompt }],
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
        const encoder = new TextEncoder();
        const upstreamBody = upstream.body;
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(metadataEvent(meta)));
            const reader = upstreamBody.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) controller.enqueue(value);
              }
            } finally {
              reader.releaseLock();
              controller.close();
            }
          },
        });
        return new Response(stream, {
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
