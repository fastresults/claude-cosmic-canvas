// Per-user rate limits backed by public.consume_rate_limit(). Call from
// inside a server function with the authenticated Supabase client so RLS
// scopes the counter to the caller. Throws a user-friendly Error when the
// caller is over budget — the sanitize middleware surfaces it with a trace.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitConfig = {
  endpoint: string;
  limit: number;
  windowSeconds?: number;
};

export async function enforceRateLimit(
  supabase: SupabaseClient,
  cfg: RateLimitConfig,
): Promise<{ remaining: number; resetAt: string }> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_endpoint: cfg.endpoint,
    p_limit: cfg.limit,
    p_window_seconds: cfg.windowSeconds ?? 60,
  });
  if (error) {
    // Fail open on infra errors so a rate-limit outage never blocks the app;
    // the underlying call still runs and is auditable via audit_log.
    return { remaining: cfg.limit, resetAt: new Date().toISOString() };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    const resetAt = row.reset_at as string;
    const seconds = Math.max(
      1,
      Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000),
    );
    throw new Error(
      `You've hit the limit for this action. Try again in ${seconds}s.`,
    );
  }
  return {
    remaining: row?.remaining ?? cfg.limit,
    resetAt: row?.reset_at ?? new Date().toISOString(),
  };
}

// Default limits per expensive endpoint. Tune from a single place.
export const RATE_LIMITS = {
  research_company: { endpoint: "research.company", limit: 6, windowSeconds: 60 },
  image_generate: { endpoint: "image.generate", limit: 20, windowSeconds: 60 },
  orchestrator: { endpoint: "orchestrator.run", limit: 30, windowSeconds: 60 },
  /** Shared budget for single-shot AI actions (voice, drafts, presets, library, onboarding, audiences, content). */
  ai_generate: { endpoint: "ai.generate", limit: 40, windowSeconds: 60 },
} satisfies Record<string, RateLimitConfig>;
