// Build a grounded prompt stack for AI generation.
// Client-safe (pure string assembly).
export type KnowledgeHit = {
  chunkId: string;
  entryId: string;
  entryTitle: string | null;
  sourceType: string;
  content: string;
};

export type GroundedPromptInput = {
  task: string;
  domain?: string | null;
  voice?: string | null;
  hits: KnowledgeHit[];
};

export const GROUNDING_SYSTEM =
  "Ground every factual claim in [KNOWLEDGE]. If a claim cannot be supported by [KNOWLEDGE], omit it. Never fabricate roles, companies, dates, numbers, or achievements.";

export function buildGroundedPrompt({ task, domain, voice, hits }: GroundedPromptInput) {
  const parts: string[] = [];
  if (domain) parts.push(`[DOMAIN]\n${domain}`);
  if (voice) parts.push(`[VOICE]\n${voice}`);
  if (hits.length) {
    const knowledge = hits
      .map((h, i) => {
        const title = h.entryTitle ?? "Untitled";
        return `${i + 1}. ${title} (${h.sourceType})\n${h.content}`;
      })
      .join("\n\n");
    parts.push(`[KNOWLEDGE]\n${knowledge}`);
  } else {
    parts.push(`[KNOWLEDGE]\n(No matching reference material found.)`);
  }
  parts.push(`[TASK]\n${task}`);
  return {
    prompt: parts.join("\n\n"),
    system: GROUNDING_SYSTEM,
  };
}
