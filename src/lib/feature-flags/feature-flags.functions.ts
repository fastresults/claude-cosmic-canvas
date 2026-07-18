// Feature flags: read global flag + optional per-user override. Cached briefly
// on the client via TanStack Query. Admin write UI lives in Settings > Content Ops.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description: string | null;
};

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: flags }, { data: overrides }] = await Promise.all([
      supabase.from("feature_flags").select("key, enabled, description").order("key"),
      supabase.from("feature_flag_overrides").select("key, enabled").eq("user_id", userId),
    ]);
    const overrideMap = new Map((overrides ?? []).map((o) => [o.key, o.enabled]));
    return (flags ?? []).map((f) => ({
      key: f.key,
      description: f.description,
      enabled: overrideMap.has(f.key) ? (overrideMap.get(f.key) as boolean) : f.enabled,
      globalEnabled: f.enabled,
      overridden: overrideMap.has(f.key),
    }));
  });

export async function isFlagEnabled(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  key: string,
): Promise<boolean> {
  const [{ data: flag }, { data: override }] = await Promise.all([
    supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle(),
    supabase
      .from("feature_flag_overrides")
      .select("enabled")
      .eq("user_id", userId)
      .eq("key", key)
      .maybeSingle(),
  ]);
  if (override) return override.enabled;
  return flag?.enabled ?? false;
}
