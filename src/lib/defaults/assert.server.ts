// Server-only helper: verify the user has picked defaults for all four
// pillars — Voice, Knowledge, Domain, Audience — in that order — before any
// content-generating action runs. Client gates already prevent this from
// firing in practice; this is the belt-and-suspenders check for direct
// server-function calls.
import type { SupabaseClient } from "@supabase/supabase-js";

export type MissingDefault = "voice" | "knowledge" | "domain" | "audience";

const ORDER: MissingDefault[] = ["voice", "knowledge", "domain", "audience"];

export async function assertUserDefaults(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const [{ data: profile }, { data: kp }, { data: dom }, { data: aud }] =
    await Promise.all([
      supabase.from("profiles").select("active_voice_id").eq("user_id", userId).maybeSingle(),
      supabase.from("knowledge_profiles").select("id").eq("user_id", userId).eq("is_default", true).maybeSingle(),
      supabase.from("domains").select("id").eq("user_id", userId).eq("is_default", true).maybeSingle(),
      supabase.from("audiences").select("id").eq("user_id", userId).eq("is_default", true).maybeSingle(),
    ]);

  const state: Record<MissingDefault, boolean> = {
    voice: !!profile?.active_voice_id,
    knowledge: !!kp?.id,
    domain: !!dom?.id,
    audience: !!aud?.id,
  };
  const missing = ORDER.filter((k) => !state[k]);

  if (missing.length > 0) {
    const firstMissing = missing[0];
    const err = new Error(
      `Finish setup first — start with ${firstMissing}. Open Settings → ${firstMissing} to continue.`,
    ) as Error & { code?: string; missing?: MissingDefault[]; firstMissing?: MissingDefault };
    err.code = "defaults_missing";
    err.missing = missing;
    err.firstMissing = firstMissing;
    throw err;
  }
}
