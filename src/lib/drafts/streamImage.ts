/**
 * Stream image bytes from /api/drafts/generate-image and invoke onFrame per event.
 * `flushSync` is mandatory — React 18 batches sibling setStates otherwise.
 */
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

const IMAGE_STREAM_TIMEOUT_MS = 120_000;

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "draft_image.metadata"; finalPrompt: string; style: StreamDraftImageMetadata["style"]; groundingSummary: string }
  | { type: "error"; error: { message: string; code?: string } };

export type StreamDraftImageInput = {
  draftId: string;
  role: "cover" | "social" | "inline";
  styleId?: string | null;
  conceptPrompt?: string;
  customDirection?: string;
  aspect?: string;
};

export type StreamDraftImageMetadata = {
  finalPrompt: string;
  groundingSummary: string;
  style: {
    styleId: string | null;
    name: string | null;
    description: string | null;
    promptPrefix: string | null;
    negativePrompt: string | null;
  } | null;
};

export async function streamDraftImage(
  input: StreamDraftImageInput,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<StreamDraftImageMetadata | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sign in to generate images.");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), IMAGE_STREAM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("/api/drafts/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (error) {
    window.clearTimeout(timeoutId);
    if (controller.signal.aborted) {
      throw new Error("Image generation timed out. Try again with a shorter prompt.");
    }
    throw error;
  }
  if (!res.ok || !res.body) {
    window.clearTimeout(timeoutId);
    const t = await res.text().catch(() => "");
    throw new Error(`Image generation failed: ${res.status} ${t}`);
  }
  let sawCompleted = false;
  let streamError: string | undefined;
  let metadata: StreamDraftImageMetadata | null = null;
  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload?.type === "error") {
        streamError =
          (payload as { error?: { message?: string } })?.error?.message ??
          "Image generation failed";
        return;
      }
      const eventType = event.event || payload?.type;
      if (eventType === "draft_image.metadata" && payload?.type === "draft_image.metadata") {
        metadata = {
          finalPrompt: payload.finalPrompt,
          groundingSummary: payload.groundingSummary,
          style: payload.style,
        };
        return;
      }
      if (
        eventType !== "image_generation.partial_image" &&
        eventType !== "image_generation.completed"
      )
        return;
      if (!payload) return;
      const isFinal = eventType === "image_generation.completed";
      flushSync(() => {
        onFrame(`data:image/png;base64,${(payload as { b64_json: string }).b64_json}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Image generation timed out. Try again with a shorter prompt.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Image stream ended without a completed event");
  return metadata;
}
