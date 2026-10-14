// Runs a model call as a stream (keeps long/tool-loop runs alive and avoids
// buffered-request timeouts) and resolves to the same shape generateText gave.
// Upstream errors captured via onError are re-thrown with their HTTP status.
import { streamText } from "ai";

type StreamArgs = Parameters<typeof streamText>[0];

export async function runStreamed(args: StreamArgs) {
  let streamError: unknown = null;
  const stream = streamText({
    ...args,
    onError: ({ error }) => {
      streamError ??= error;
    },
  });
  try {
    const [text, steps, usage, finishReason] = await Promise.all([
      stream.text,
      stream.steps,
      stream.totalUsage,
      stream.finishReason,
    ]);
    if (streamError) throw streamError;
    return { text, steps, usage, finishReason };
  } catch (e) {
    throw streamError ?? e;
  }
}
