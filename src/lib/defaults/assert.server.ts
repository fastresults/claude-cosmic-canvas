// Server-only helper: verify the user has picked defaults for voice,
// knowledge, and domain before any content-generating action runs.
// The client gate already prevents this from firing in practice; this is the
// belt-and-suspenders check for direct API calls.
import type { SupabaseClient } from "@supabase/supabase-js";

export type MissingDefault = "voice" | "knowledge" | "domain";

export async function assertUserDefaults(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const missing: MissingDefault[] = [];

  const [{ data: profile }, { data: kp }, { data: dom }] = await Promise.all([
    supabase.from("profiles").select("active_voice_id").eq("user_id", userId).maybeSingle(),
    supabase.from("knowledge_profiles").select("id").eq("user_id", userId).eq("is_default", true).maybeSingle(),
    supabase.from("domains").select("id").eq("user_id", userId).eq("is_default", true).maybeSingle(),
  ]);

  if (!profile?.active_voice_id) missing.push("voice");
  if (!kp?.id) missing.push("knowledge");
  if (!dom?.id) missing.push("domain");

  if (missing.length > 0) {
    const err = new Error(
      `Set your defaults first — missing: ${missing.join(", ")}. Open Settings to pick a default voice, knowledge profile, and domain.`,
    ) as Error & { code?: string; missing?: MissingDefault[] };
    err.code = "defaults_missing";
    err.missing = missing;
    throw err;
  }
}
