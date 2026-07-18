import { createMiddleware } from "@tanstack/react-start";

/**
 * Server-function middleware that sanitizes thrown errors before they cross
 * the RPC boundary. Full error (with Postgres details/hint/schema info) is
 * logged server-side; the client sees a compact, safe message.
 *
 * Redirects and Response-shaped throws pass through untouched.
 */
export const sanitizeServerFnErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      // Pass framework signals through untouched.
      if (error instanceof Response) throw error;
      if (
        error != null &&
        typeof error === "object" &&
        ("statusCode" in error || "isRedirect" in error || "routerCode" in error)
      ) {
        throw error;
      }

      // Full detail server-side only.
      console.error("[server-fn]", error);

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

      const safe =
        !message || /permission denied|violates row-level security/i.test(message)
          ? "You do not have access to this resource."
          : message.length > 240
            ? "Something went wrong. Please try again."
            : message;

      throw new Error(safe);
    }
  },
);
