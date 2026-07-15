/**
 * Milestone context resolver — pulls the user's active voice, knowledge
 * profile (with top matching chunks), domain, audience, and preset, so the
 * Actor prompt always writes with the user's real signal.
 *
 * Server-only: import inside a server-fn handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MilestoneContext = {
  displayName: string | null;
  domain: string | null;
  audience: string | null;
  personaId: string | null;
  voiceDirectives: unknown;
  knowledgeProfileId: string | null;
  knowledgeSnippets: { title: string; content: string }[];
  presetId: string | null;
  missing: string[]; // e.g. ["voice","knowledge"] — used to hint user in UI
};

// Best-effort resolver. Every branch is defensive: if a signal is absent
// the Actor still runs, and we surface what was missing so the UI can nudge
// the user to add it.
export async function resolveMilestoneContext(
  supabase: SupabaseClient<any>,
  userId: string,
  intent: string,
): Promise<MilestoneContext> {
  const missing: string[] = [];
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, persona_active_id")
    .eq("user_id", userId)
    .maybeSingle();

  const personaId: string | null = profile?.persona_active_id ?? null;

  let voiceDirectives: unknown = null;
  if (personaId) {
    const { data: voice } = await supabase
      .from("voice_profiles")
      .select("directives")
      .eq("persona_id", personaId)
      .maybeSingle();
    voiceDirectives = voice?.directives ?? null;
  }
  if (!voiceDirectives) missing.push("voice");

  // Active knowledge profile — user-pinned default, else first created.
  const { data: kp } = await supabase
    .from("knowledge_profiles")
    .select("id, name, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const knowledgeProfileId: string | null = kp?.id ?? null;
  if (!knowledgeProfileId) missing.push("knowledge");

  // Default domain (name only — used as [DOMAIN] hint in the prompt).
  const { data: defaultDomain } = await supabase
    .from("domains")
    .select("name")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  // Pull a handful of matching knowledge entries by title/tag substring —
  // avoids requiring an embedding call inside the milestone flow.
  const knowledgeSnippets: { title: string; content: string }[] = [];
  if (knowledgeProfileId) {
    const { data: entries } = await supabase
      .from("knowledge_entries")
      .select("title, summary, tags")
      .eq("user_id", userId)
      .eq("profile_id", knowledgeProfileId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (entries) {
      const needle = intent.toLowerCase();
      const scored = entries
        .map((e) => {
          const hay = `${e.title ?? ""} ${(e.tags ?? []).join(" ")}`.toLowerCase();
          let score = 0;
          for (const tok of needle.split(/\s+/).filter((t) => t.length > 3)) {
            if (hay.includes(tok)) score += 1;
          }
          return { e, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((x) => ({ title: x.e.title ?? "Untitled", content: (x.e.summary ?? "").slice(0, 400) }));
      knowledgeSnippets.push(...scored);
    }
  }

  // Active preset (most-recent used).
  const { data: preset } = await supabase
    .from("presets")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    displayName: profile?.display_name ?? null,
    domain: defaultDomain?.name ?? null,
    audience: null,
    personaId,
    voiceDirectives,
    knowledgeProfileId,
    knowledgeSnippets,
    presetId: preset?.id ?? null,
    missing,
  };
}

/** Compact context block appended to Actor system prompt. */
export function contextBlock(ctx: MilestoneContext): string {
  const lines: string[] = [];
  lines.push(`[USER]\nName: ${ctx.displayName ?? "(unknown)"}`);
  lines.push(`[DOMAIN]\n${ctx.domain ?? "(not set)"}`);
  lines.push(`[AUDIENCE]\n${ctx.audience ?? "(not set)"}`);
  lines.push(
    ctx.voiceDirectives
      ? `[VOICE]\n${JSON.stringify(ctx.voiceDirectives).slice(0, 1800)}`
      : `[VOICE]\n(none — match the user's display name and keep tone confident, first-person)`,
  );
  lines.push(
    ctx.knowledgeSnippets.length
      ? `[KNOWLEDGE]\n${ctx.knowledgeSnippets.map((k) => `- ${k.title}: ${k.content}`).join("\n")}`
      : `[KNOWLEDGE]\n(no matching entries pre-fetched)`,
  );
  return lines.join("\n\n");
}
