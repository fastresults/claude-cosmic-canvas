// Server-only Anthropic Messages API client.
// Do NOT import from client-reachable modules; use only from server fn handlers.

type AnthropicCallInput = {
  model: string;
  maxTokens: number;
  prompt: string;
  system?: string;
};

type AnthropicResponse = {
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

export async function callAnthropic({
  model,
  maxTokens,
  prompt,
  system,
}: AnthropicCallInput) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const text = data.content
    .map((block) => (block.type === "text" ? block.text ?? "" : ""))
    .join("");

  return {
    text,
    stopReason: data.stop_reason,
    usage: data.usage,
  };
}
