// Preset injection contract — deterministic prompt assembly for grounded generation.
// Client-safe (pure string assembly).

import type { KnowledgeHit } from "@/lib/knowledge/grounded-prompt";
import { GROUNDING_SYSTEM } from "@/lib/knowledge/grounded-prompt";

export type PresetInjection = {
  domains: string[];
  audiences: string[];
  /** Rich audience block from renderAudienceBlock(). When set, takes precedence over `audiences`. */
  audienceBlock?: string | null;
  voice: string | null;
  briefConfig: Record<string, unknown>;
  factorWeights: Record<string, number>;
  hits: KnowledgeHit[];
  task: string;
};

/**
 * Non-negotiable ordering: [DOMAIN] → [AUDIENCE] → [VOICE] → [KNOWLEDGE] → [PRESET] → [TASK]
 */
export function buildPresetPrompt(i: PresetInjection) {
  const parts: string[] = [];

  if (i.domains.length) parts.push(`[DOMAIN]\n${i.domains.join(", ")}`);
  if (i.audienceBlock && i.audienceBlock.trim().length > 0) {
    parts.push(`[AUDIENCE]\n${i.audienceBlock.trim()}`);
  } else if (i.audiences.length) {
    parts.push(`[AUDIENCE]\n${i.audiences.join(", ")}`);
  }
  if (i.voice) parts.push(`[VOICE]\n${i.voice}`);

  if (i.hits.length) {
    const k = i.hits
      .map((h, idx) => `${idx + 1}. ${h.entryTitle ?? "Untitled"} (${h.sourceType})\n${h.content}`)
      .join("\n\n");
    parts.push(`[KNOWLEDGE]\n${k}`);
  } else {
    parts.push(`[KNOWLEDGE]\n(No matching reference material found.)`);
  }

  const presetLines: string[] = [];
  if (i.audiences.length) presetLines.push(`Audience: ${i.audiences.join(", ")}`);
  for (const [k, v] of Object.entries(i.briefConfig)) {
    if (v === null || v === undefined || v === "") continue;
    presetLines.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  for (const [k, v] of Object.entries(i.factorWeights)) {
    presetLines.push(`weight.${k}: ${v}`);
  }
  if (presetLines.length) parts.push(`[PRESET]\n${presetLines.join("\n")}`);

  parts.push(`[TASK]\n${i.task}`);

  return {
    prompt: parts.join("\n\n"),
    system: GROUNDING_SYSTEM,
  };
}
