/**
 * Per-format prompt rules. Injected as [FORMAT_RULES] in the injection contract.
 * Keep terse: length, structure, tone.
 */
import type { CreateFormat } from "@/config/createFormats";

export function formatRules(f: CreateFormat, opts?: { channels?: string[] }): string {
  // Social Post is channel-native — delegate to channel-aware rules.
  if (f.id === "post-content") {
    // Lazy import to avoid a client-only channel-specs pull into consumers
    // that don't need it. Safe because this file is imported server-side.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { socialPostRules, normalizeSocialChannels } = require("./channel-rules");
    const channels = normalizeSocialChannels(opts?.channels ?? []);
    return socialPostRules(channels.length ? channels : ["linkedin"]);
  }

  const base = f.defaultLength > 0 ? `Target length: ~${f.defaultLength} words.` : "";
  const structure = STRUCTURES[f.id] ?? DEFAULT_STRUCTURES[f.category] ?? "Well-structured paragraphs with clear headers where useful.";
  const tone = TONE[f.category] ?? "Confident, concrete, no filler.";
  return [
    `Format: ${f.label} — ${f.description}`,
    base,
    `Structure: ${structure}`,
    `Tone: ${tone}`,
    `Output ONLY the final ${f.label}. No preamble, no meta commentary.`,
  ]
    .filter(Boolean)
    .join("\n");
}


const STRUCTURES: Record<string, string> = {
  "press-release": "Dateline; punchy headline; subhead; lead paragraph; body with 2-3 quotes; boilerplate; contact block.",
  "whitepaper": "Cover; executive summary; problem; approach; evidence; recommendations; references.",
  "case-study": "Customer intro; challenge; solution; results with numbers; quote; next steps.",
  "op-ed": "Strong opening hook; clear thesis; 3 supporting arguments; counter and rebuttal; call to action.",
  "bio": "Return three variants labeled Short (50w), Medium (120w), Long (250w).",
  "email-sequence": "Return 4-6 emails, each with subject + body, separated by `---EMAIL---`.",
  "newsletter-sequence": "Return 3 issues, each with subject + intro + main + sign-off, separated by `---ISSUE---`.",
  "agenda": "Numbered items with time boxes and owners.",
  "meeting-notes": "Attendees; decisions; action items with owner + due date; open questions.",
  "youtube-script": "Hook (0-15s); arc with beats; CTA. Include on-screen cues in brackets.",
  "post-content": "Hook line; 2-4 short paragraphs; single CTA. No hashtag salad.",
  "quick-email": "Subject; 3-5 sentence body; single ask.",
  "podcast": "Show title; episode summary; guest bio; 8-12 interview questions; outro.",
  "webinar": "Title; abstract; slide-by-slide outline; speaker notes per slide.",
  "campaign-builder": "Objective; audience; message; channel mix; asset checklist; timeline; KPIs.",
};

const DEFAULT_STRUCTURES: Partial<Record<CreateFormat["category"], string>> = {
  "long-form": "Title; opening; body sections with clear headers; conclusion.",
  sequence: "Multiple parts labeled and separated by `---`.",
  speaking: "Ordered sections with time or step markers.",
  "short-form": "Single tight piece, no headers.",
  campaign: "Sections: objective, audience, tactics, KPIs.",
  research: "Sections: summary, findings, sources.",
  media: "N/A",
};

const TONE: Partial<Record<CreateFormat["category"], string>> = {
  "long-form": "Authoritative, specific, grounded in provided knowledge.",
  sequence: "Warm, human, each part earning the next open.",
  speaking: "Clear, spoken cadence, easy to read aloud.",
  "short-form": "Punchy, one thought per line where it helps.",
  campaign: "Decisive, planner-ready, numbers over adjectives.",
  research: "Neutral, cited, no speculation.",
  media: "N/A",
};
