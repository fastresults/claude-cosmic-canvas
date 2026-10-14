// Function middleware: requires sign-in, then consumes one unit of the shared
// per-user AI generation budget. Use in place of requireSupabaseAuth on any
// server function that calls a model.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const aiRateLimit = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { enforceRateLimit, RATE_LIMITS } = await import("./rate-limit.server");
    await enforceRateLimit(context.supabase, RATE_LIMITS.ai_generate);
    return next();
  });
