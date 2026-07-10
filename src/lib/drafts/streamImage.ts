/**
 * Stream image bytes from /api/drafts/generate-image and invoke onFrame per event.
 * `flushSync` is mandatory — React 18 batches sibling setStates otherwise.
 */
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string; code?: string } };

export async function streamDraftImage(
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  aspect = "16:9",
  negativePrompt?: string,
): Promise<void> {
  const res = await fetch("/api/drafts/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect, negativePrompt }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`Image generation failed: ${res.status} ${t}`);
  }
  let sawCompleted = false;
  let streamError: string | undefined;
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
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      if (!payload) return;
      const isFinal = event.event === "image_generation.completed";
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
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Image stream ended without a completed event");
}
