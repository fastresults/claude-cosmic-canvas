import { createMiddleware } from "@tanstack/react-start";
import { friendlyGatewayMessage } from "@/lib/ai/gateway-errors";

function extractAiStatus(error: unknown): number | null {
  if (error == null || typeof error !== "object") return null;
  const e = error as { name?: string; status?: unknown; statusCode?: unknown; lastError?: unknown };
  if (e.name === "GatewayError" && typeof e.status === "number") return e.status;
  if (e.name === "AI_APICallError" && typeof e.statusCode === "number") return e.statusCode;
  if (e.name === "AI_RetryError") return extractAiStatus(e.lastError);
  return null;
}

/**
 * Server-function middleware that sanitizes thrown errors before they cross
 * the RPC boundary. Full error (with Postgres details/hint/schema info) is
 * logged server-side with a short trace ID; the client sees a compact, safe
 * message that ends with "(trace: XXXX)" so users can reference it in support.
 *
 * Redirects and Response-shaped throws pass through untouched.
 */
function shortTraceId() {
  // 8 hex chars — collision odds are fine for support lookup within audit_log time window.
  return Math.random().toString(16).slice(2, 10);
}

export const sanitizeServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      // Pass framework signals through untouched.
      if (error instanceof Response) throw error;

      // AI Gateway failures (AI SDK APICallError / RetryError, or our
      // GatewayError) carry an HTTP status — map to a friendly message and
      // never forward the raw upstream body.
      const aiStatus = extractAiStatus(error);
      if (aiStatus != null) {
        const traceId = shortTraceId();
        console.error(`[server-fn] ai trace=${traceId}`, error);
        throw new Error(`${friendlyGatewayMessage(aiStatus)} (trace: ${traceId})`);
      }
      if (
        error != null &&
        typeof error === "object" &&
        ("statusCode" in error || "isRedirect" in error || "routerCode" in error)
      ) {
        throw error;
      }

      const traceId = shortTraceId();

      // Full detail server-side only, tagged with the trace ID.
      console.error(`[server-fn] trace=${traceId}`, error);

      const raw =
        error != null && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : String(error ?? "");

      // Strip Postgres/PostgREST internals that leak schema shape.
      const message = raw
        .replace(/relation "[^"]+"/gi, "resource")
        .replace(/column "[^"]+"/gi, "field")
        .replace(/\bschema "[^"]+"/gi, "schema")
        .replace(/\b(hint|details?|code):\s*[^\n,]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const base =
        !message || /permission denied|violates row-level security/i.test(message)
          ? "You do not have access to this resource."
          : message.length > 240
            ? "Something went wrong. Please try again."
            : message;

      throw new Error(`${base} (trace: ${traceId})`);
    }
  },
);
