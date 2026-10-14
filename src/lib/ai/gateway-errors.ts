// Maps Lovable AI Gateway HTTP statuses to safe, human-readable messages.
// Raw upstream bodies are never shown to users — log them server-side only.

export function friendlyGatewayMessage(status: number): string {
  if (status === 402) {
    return "You're out of AI credits. Top up in Settings → Plans & credits, then try again.";
  }
  if (status === 429) return "Eve is busy right now. Please try again in a moment.";
  if (status === 403) return "This AI action isn't available for your workspace right now.";
  if (status === 401) return "AI isn't configured correctly. Please contact support.";
  if (status === 400) return "The AI couldn't process that request. Try shortening or rephrasing it.";
  if (status >= 500) return "The AI service had a hiccup. Please try again.";
  return "The AI request failed. Please try again.";
}

export class GatewayError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(friendlyGatewayMessage(status));
    this.name = "GatewayError";
    this.status = status;
  }
}

export function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

/** Wait time for a retry, honouring Retry-After when present. */
export function retryDelayMs(attempt: number, retryAfter: string | null) {
  const s = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(s) && s > 0) return Math.min(s * 1000, 20_000);
  return Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 300);
}
