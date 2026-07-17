// Server-only: single source of truth for the orchestrator's system prompt.
// Composes, in order:
//   1. Eve Actor persona
//   2. Voice style block (from voice_profiles + active directives)
//   3. Optional Milestone context block (user/domain/audience/knowledge)
//   4. Surface-specific instructions passed by the caller
//
// The voice gate lives in the caller (orchestrate / orchestrateWithTools):
// if no voice, we short-circuit BEFORE composing this prompt.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MILESTONE_ACTOR_SYSTEM } from "@/lib/workspaces/actor";
import { formatStyleContext } from "@/lib/voice/format-style-context.server";
import { contextBlock, resolveMilestoneContext, type MilestoneContext } from "@/lib/workspaces/context.server";
import { audiencePromptBlock, type AudienceForPrompt } from "@/lib/audiences/render";

export type OrchestratorSurface =
  | "generic"
  | "create"
  | "milestone"
  | "brain"
  | "knowledge"
  | "copilot";

type Voice = Parameters<typeof formatStyleContext>[0];
type Directive = { directive_type: string; directive_text: string; evidence_count: number };

export type ComposeSystemArgs = {
  voice: Voice;
  directives: Directive[];
  context?: MilestoneContext | null;
  audience?: AudienceForPrompt | null;
  surface: OrchestratorSurface;
  surfaceInstructions?: string;
};

const SURFACE_HINTS: Record<OrchestratorSurface, string> = {
  generic: "",
  create:
    "You are drafting a single piece of content. Respect the requested format, channel, tone, and length exactly. If channel-native rules apply (X, LinkedIn, Instagram), follow them without being asked. Always write for the [AUDIENCE] below — if none is present, ask who the reader is before drafting.",
  milestone:
    "You are running a milestone pipeline. Plan in phases (tease, announce, amplify, sustain) and rank channels by role (anchor, amplifier, proof, community), weighted by fit to [AUDIENCE.channels]. Delegate to tools rather than writing everything inline.",
  brain:
    "You are answering from the user's Second Brain. Prefer tool calls (brain.search, brain.expand_node) over speculation. Cite retrieved nodes when you use them.",
  knowledge:
    "You are ingesting new signal into the user's Brain. Extract structure, tag, and hand off to the appropriate ingest tool.",
  copilot:
    "You are the user's global copilot. Choose the smallest useful tool, keep replies short, and confirm destructive actions before taking them. When drafting or planning content, respect the active [AUDIENCE].",
};

export function composeOrchestratorSystem(args: ComposeSystemArgs): string {
  const blocks: string[] = [MILESTONE_ACTOR_SYSTEM];

  blocks.push(formatStyleContext(args.voice, { activeDirectives: args.directives ?? [] }));

  // Audience is a first-class pillar — inject on every surface when present.
  const aud = audiencePromptBlock(args.audience ?? null);
  if (aud) blocks.push(aud);

  if (args.context) blocks.push(contextBlock(args.context));

  const hint = SURFACE_HINTS[args.surface];
  if (hint) blocks.push(`[SURFACE: ${args.surface}]\n${hint}`);

  if (args.surfaceInstructions?.trim()) {
    blocks.push(args.surfaceInstructions.trim());
  }

  return blocks.join("\n\n---\n\n");
}

/** Convenience: load voice + directives + (optional) milestone context in one call. */
export async function loadOrchestratorContext(
  supabase: SupabaseClient<any>,
  userId: string,
  opts: {
    voiceId?: string | null;
    intent?: string;
    includeMilestoneContext?: boolean;
  } = {},
) {
  async function pickVoice(id: string) {
    const { data } = await supabase.from("voice_profiles").select("*").eq("id", id).maybeSingle();
    return data;
  }

  let voice: Awaited<ReturnType<typeof pickVoice>> = null;
  if (opts.voiceId) voice = await pickVoice(opts.voiceId);
  if (!voice) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("active_voice_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof?.active_voice_id) voice = await pickVoice(prof.active_voice_id);
  }
  if (!voice) {
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    voice = data;
  }
  if (!voice) {
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    voice = data;
  }

  if (!voice) return { needsVoice: true as const };

  const { data: directives } = await supabase
    .from("voice_directives")
    .select("directive_type, directive_text, evidence_count")
    .eq("voice_profile_id", voice.id)
    .eq("status", "active");

  let context: MilestoneContext | null = null;
  if (opts.includeMilestoneContext) {
    context = await resolveMilestoneContext(supabase, userId, opts.intent ?? "");
  }

  // Always load the active audience so every surface can inject the ICP.
  const { data: audienceRow } = await supabase
    .from("audiences")
    .select("name, description, icp")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  const audience: AudienceForPrompt | null = audienceRow
    ? {
        name: (audienceRow as { name?: string | null }).name ?? null,
        description: (audienceRow as { description?: string | null }).description ?? null,
        icp: ((audienceRow as { icp?: unknown }).icp ?? null) as AudienceForPrompt["icp"],
      }
    : null;

  return {
    needsVoice: false as const,
    voice,
    directives: directives ?? [],
    context,
    audience,
  };
}
