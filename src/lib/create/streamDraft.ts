// Browser client for /api/drafts/generate-stream (NDJSON). Calls onText with
// the accumulated text as it arrives and resolves to the final result.
import { supabase } from "@/integrations/supabase/client";
import type { GenerateDraftResult } from "./create.server";

export type StreamDraftInput = {
  formatId: string;
  seed: string;
  draftId?: string;
  workspaceId?: string | null;
  workspaceItemId?: string | null;
  channels?: string[];
  title?: string;
};

export async function streamCreateDraft(
  input: StreamDraftInput,
  onText: (fullText: string) => void,
): Promise<GenerateDraftResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again to write drafts.");

  const res = await fetch("/api/drafts/generate-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok || !res.body) {
    if (res.status === 429) throw new Error("You're writing a lot right now — wait a minute and try again.");
    throw new Error("Couldn't start writing your draft. Please try again.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let final: GenerateDraftResult | null = null;
  let errorMessage: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line) as
          | { type: "delta"; text: string }
          | { type: "done"; result: GenerateDraftResult }
          | { type: "error"; message: string };
        if (evt.type === "delta") {
          text += evt.text;
          onText(text);
        } else if (evt.type === "done") final = evt.result;
        else errorMessage = evt.message;
      } catch {
        /* ignore partial line */
      }
    }
  }
  if (errorMessage) throw new Error(errorMessage);
  if (!final) throw new Error("The draft stopped before it finished. Please try again.");
  return final;
}
