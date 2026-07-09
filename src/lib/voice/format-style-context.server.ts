// Server-only: composes the style context prepended to every AI generation.
// This is THE single integration point — every generation server fn must
// resolve the active voice and call this before prompting the model.

type Profile = {
  id: string;
  name: string;
  tone: string | null;
  guidelines: string | null;
  vocabulary_preferred: string[] | null;
  vocabulary_avoid: string[] | null;
  formality: number;
  humor: number;
  technicality: number;
  conciseness: number;
  samples: unknown;
};

type Directive = { directive_type: string; directive_text: string; evidence_count: number };

function readSamples(raw: unknown): Array<{ text: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { text: string } => !!s && typeof (s as { text?: unknown }).text === "string")
    .slice(0, 2);
}

export function formatStyleContext(
  profile: Profile,
  opts: { activeDirectives?: Directive[] } = {},
): string {
  const parts: string[] = [];
  parts.push(`WRITING VOICE: ${profile.name}`);

  if (profile.tone) parts.push(`Tone: ${profile.tone}`);

  parts.push(
    `Sliders (0-100): formality=${profile.formality}, humor=${profile.humor}, ` +
      `technicality=${profile.technicality}, conciseness=${profile.conciseness}`,
  );

  if (profile.guidelines?.trim()) {
    parts.push(`Guidelines:\n${profile.guidelines.trim()}`);
  }

  const pref = profile.vocabulary_preferred?.filter(Boolean) ?? [];
  const avoid = profile.vocabulary_avoid?.filter(Boolean) ?? [];
  if (pref.length) parts.push(`Prefer these words/phrases: ${pref.join(", ")}`);
  if (avoid.length) parts.push(`Never use these: ${avoid.join(", ")}`);

  const samples = readSamples(profile.samples);
  if (samples.length) {
    parts.push(
      "Reference writing samples (match cadence and word choice, do not copy):\n" +
        samples.map((s, i) => `--- Sample ${i + 1} ---\n${s.text}`).join("\n"),
    );
  }

  const directives = (opts.activeDirectives ?? [])
    .slice()
    .sort((a, b) => b.evidence_count - a.evidence_count)
    .slice(0, 50);
  if (directives.length) {
    parts.push(
      "LEARNED PREFERENCES (soft rules — apply when in doubt):\n" +
        directives.map((d) => `- [${d.directive_type}] ${d.directive_text}`).join("\n"),
    );
  }

  return parts.join("\n\n");
}
