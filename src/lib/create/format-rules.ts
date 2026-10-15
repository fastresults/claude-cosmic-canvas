/**
 * Per-format prompt rules. Injected as [FORMAT_RULES] in the injection contract.
 * Keep terse: length, structure, tone.
 */
import type { CreateFormat } from "@/config/createFormats";
import { socialPostRules, normalizeSocialChannels } from "./channel-rules";

export function formatRules(f: CreateFormat, opts?: { channels?: string[] }): string {
  // Social Post is channel-native — delegate to channel-aware rules.
  if (f.id === "post-content") {
    const channels = normalizeSocialChannels(opts?.channels ?? []);
    return socialPostRules(channels.length ? channels : ["linkedin"]);
  }



  const base = f.defaultLength > 0 ? `Target length: ~${f.defaultLength} words.` : "";
  const structure = STRUCTURES[f.id] ?? DEFAULT_STRUCTURES[f.category] ?? "Well-structured paragraphs with clear headers where useful.";
  const tone = TONE[f.category] ?? "Confident, concrete, no filler.";
  const markdown = MARKDOWN_DIRECTIVE[f.category] ?? "";
  return [
    `Format: ${f.label} — ${f.description}`,
    base,
    `Structure: ${structure}`,
    `Tone: ${tone}`,
    markdown,
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

// Formatting directive per category. Long-form pieces must arrive as real
// Markdown so the reader renders editorial hierarchy, not a wall of text.
const MARKDOWN_DIRECTIVE: Partial<Record<CreateFormat["category"], string>> = {
  "long-form":
    "Formatting: rich Markdown. Use ## for major sections and ### for sub-sections, numbered or bulleted lists wherever content enumerates, **bold** for key terms, and exactly one > pull quote per major section quoting its single most striking sentence.",
  research:
    "Formatting: rich Markdown. Use ## for major sections and ### for sub-sections, bulleted lists for findings, **bold** for key terms, and > blockquotes for notable sourced statements.",
  campaign:
    "Formatting: rich Markdown. Use ## for sections, bulleted lists for tactics and checklists, and **bold** for KPIs and key terms.",
  speaking:
    "Formatting: Markdown. Use ## for sections and bulleted lists for beats or questions.",
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
