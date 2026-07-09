// Client-safe server function surface for Lovable AI Gateway (STT, embeddings, images)
// plus Claude Fable 5 thinking calls. Every call records a Brain provenance edge.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Claude thinking (delegates to existing orchestrator) ----------

const ThinkInput = z.object({
  prompt: z.string().min(1),
  system: z.string().optional(),
  /** Optional brain provenance: link generated output back to a source node. */
  provenance: z
    .object({
      srcType: z.string(),
      srcId: z.string(),
      dstType: z.string(),
      dstId: z.string(),
    })
    .optional(),
});

export const aiThink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ThinkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { recordGeneration } = await import("./provenance.server");

    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt: data.prompt,
      system: data.system,
    });

    if (data.provenance) {
      await recordGeneration(context.supabase, context.userId, {
        tool: "claude",
        model: ORCHESTRATOR_MODEL,
        srcType: data.provenance.srcType as never,
        srcId: data.provenance.srcId,
        dstType: data.provenance.dstType as never,
        dstId: data.provenance.dstId,
        usage: result.usage,
      });
    }

    return result;
  });

// ---------- Embeddings ----------

const EmbedInput = z.object({
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  model: z.string().default("openai/text-embedding-3-small"),
});

export const aiEmbed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EmbedInput.parse(input))
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("./gateway.server");
    const res = await gatewayFetch("/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: data.model, input: data.input }),
    });
    const json = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { prompt_tokens: number; total_tokens: number };
    };
    return {
      embeddings: json.data.map((d) => d.embedding),
      usage: json.usage,
      model: data.model,
    };
  });

// ---------- Speech-to-text ----------

const TranscribeInput = z.object({
  /** base64-encoded audio bytes */
  audioBase64: z.string().min(1),
  mimeType: z.string().default("audio/webm"),
  model: z.string().default("openai/gpt-4o-transcribe"),
});

export const aiTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranscribeInput.parse(input))
  .handler(async ({ data }) => {
    const cleanMimeType = data.mimeType.split(";")[0]?.trim().toLowerCase();
    const ext =
      cleanMimeType === "audio/webm"
        ? "webm"
        : cleanMimeType === "audio/mp4"
          ? "mp4"
          : cleanMimeType === "audio/mpeg"
            ? "mp3"
            : cleanMimeType === "audio/wav" || cleanMimeType === "audio/wave"
              ? "wav"
              : cleanMimeType === "audio/ogg"
                ? "ogg"
                : "webm";
    const { gatewayFetch } = await import("./gateway.server");
    const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: data.mimeType });
    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("model", data.model);
    const res = await gatewayFetch("/audio/transcriptions", {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as { text: string };
    return { text: json.text, model: data.model };
  });

// ---------- Image generation ----------

const ImageInput = z.object({
  prompt: z.string().min(1),
  model: z.string().default("google/gemini-2.5-flash-image"),
  provenance: z
    .object({
      srcType: z.string(),
      srcId: z.string(),
      dstType: z.string(),
      dstId: z.string(),
    })
    .optional(),
});

export const aiImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { gatewayFetch } = await import("./gateway.server");
    const { recordGeneration } = await import("./provenance.server");
    const res = await gatewayFetch("/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: data.model, prompt: data.prompt }),
    });
    const json = (await res.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };
    const image = json.data[0];

    if (data.provenance) {
      await recordGeneration(context.supabase, context.userId, {
        tool: "gateway",
        model: data.model,
        srcType: data.provenance.srcType as never,
        srcId: data.provenance.srcId,
        dstType: data.provenance.dstType as never,
        dstId: data.provenance.dstId,
      });
    }

    return { image, model: data.model };
  });
