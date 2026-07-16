/**
 * Per-channel framing rules. Injected into the drafter prompt so copy is
 * native to the channel, not repurposed.
 */
import type { Channel } from "./strategy";

export type ChannelSpec = {
  channel: Channel;
  label: string;
  max_chars: number;
  ideal_chars: [number, number];
  structure: string;
  hook_style: string;
  cta_style: string;
  hashtag_policy: string;
  link_policy: string;
  tone_hint: string;
};

export const CHANNEL_SPECS: Record<Channel, ChannelSpec> = {
  linkedin: {
    channel: "linkedin",
    label: "LinkedIn",
    max_chars: 3000,
    ideal_chars: [900, 1400],
    structure: "1-line hook · 3–6 short paragraphs · single-line takeaway · optional soft CTA",
    hook_style: "specific observation or contrarian claim; no 'excited to announce'",
    cta_style: "invitation to reply or reflect, not a link",
    hashtag_policy: "0–3 tasteful hashtags at end",
    link_policy: "avoid links in body; put in first comment",
    tone_hint: "confident, first-person, useful",
  },
  x: {
    channel: "x",
    label: "X",
    max_chars: 280,
    ideal_chars: [180, 260],
    structure: "single sharp beat · optional line break",
    hook_style: "punchline first; kill throat-clearing",
    cta_style: "none, or a single word invitation",
    hashtag_policy: "0 hashtags",
    link_policy: "link at end only if essential",
    tone_hint: "punchy, quotable",
  },
  blog: {
    channel: "blog",
    label: "Blog",
    max_chars: 12000,
    ideal_chars: [900, 1600],
    structure: "H1 · lede · 3–5 H2 sections · closing CTA",
    hook_style: "concrete stakes in the first two sentences",
    cta_style: "single clear next step",
    hashtag_policy: "none",
    link_policy: "inline links to sources",
    tone_hint: "editorial, first-person authority",
  },
  press_release: {
    channel: "press_release",
    label: "Press release",
    max_chars: 4000,
    ideal_chars: [400, 700],
    structure: "dateline · headline · subhead · lede · 2–3 body paragraphs · quote · boilerplate",
    hook_style: "newsworthy fact first, AP style",
    cta_style: "press contact only",
    hashtag_policy: "none",
    link_policy: "hero URL in boilerplate",
    tone_hint: "third-person, neutral, factual",
  },
  email: {
    channel: "email",
    label: "Email",
    max_chars: 3000,
    ideal_chars: [180, 320],
    structure: "subject · preheader · 1-sentence why-now · 2 short paras · single CTA",
    hook_style: "subject <45 chars, curiosity or utility",
    cta_style: "one button, imperative verb",
    hashtag_policy: "none",
    link_policy: "one primary CTA link",
    tone_hint: "direct, conversational, one-to-one",
  },
  podcast: {
    channel: "podcast",
    label: "Podcast",
    max_chars: 6000,
    ideal_chars: [400, 800],
    structure: "pitch angle · guest bio · 3 topic beats · sample questions",
    hook_style: "why this guest, why now",
    cta_style: "booking ask",
    hashtag_policy: "none",
    link_policy: "one calendar link",
    tone_hint: "warm, specific, host-flattering",
  },
  youtube: {
    channel: "youtube",
    label: "YouTube",
    max_chars: 5000,
    ideal_chars: [300, 600],
    structure: "title · hook script (15s) · beats · CTA",
    hook_style: "curiosity gap in first 5 seconds",
    cta_style: "subscribe + next-video prompt",
    hashtag_policy: "3–5 tags",
    link_policy: "resources in description",
    tone_hint: "energetic, direct address",
  },
  event: {
    channel: "event",
    label: "Event",
    max_chars: 2500,
    ideal_chars: [300, 600],
    structure: "what · who it's for · when/where · agenda · RSVP",
    hook_style: "specific outcome attendee gets",
    cta_style: "RSVP link",
    hashtag_policy: "1 event hashtag",
    link_policy: "one RSVP link",
    tone_hint: "inviting, concrete",
  },
  community: {
    channel: "community",
    label: "Community",
    max_chars: 2000,
    ideal_chars: [200, 500],
    structure: "context · question or ask · optional link",
    hook_style: "member-first, no announcement voice",
    cta_style: "reply or react",
    hashtag_policy: "none",
    link_policy: "optional, non-promo",
    tone_hint: "peer, humble, curious",
  },
  instagram: {
    channel: "instagram",
    label: "Instagram",
    max_chars: 2200,
    ideal_chars: [150, 400],
    structure: "hook line · 2–4 short paras · line-break CTA",
    hook_style: "visual-first, emotive",
    cta_style: "save/share prompt",
    hashtag_policy: "5–10 targeted hashtags",
    link_policy: "link-in-bio reference only",
    tone_hint: "warm, personal, image-led",
  },
  tiktok: {
    channel: "tiktok",
    label: "TikTok",
    max_chars: 2200,
    ideal_chars: [80, 200],
    structure: "3-beat script · on-screen text cues",
    hook_style: "first 2s pattern-break",
    cta_style: "follow for more, or comment prompt",
    hashtag_policy: "3–5 hashtags",
    link_policy: "bio link only",
    tone_hint: "fast, informal, visual",
  },
  threads: {
    channel: "threads",
    label: "Threads",
    max_chars: 500,
    ideal_chars: [200, 450],
    structure: "one short beat · optional reply-line",
    hook_style: "casual observation, no announcement voice",
    cta_style: "invite a reply",
    hashtag_policy: "0 hashtags",
    link_policy: "avoid links",
    tone_hint: "conversational, low-key, first-person",
  },
  facebook: {
    channel: "facebook",
    label: "Facebook",
    max_chars: 5000,
    ideal_chars: [300, 700],
    structure: "warm opener · 2–4 short paragraphs · single question or CTA",
    hook_style: "personal moment or clear stakes",
    cta_style: "invite comments or shares",
    hashtag_policy: "0–2 hashtags",
    link_policy: "one link at end is fine",
    tone_hint: "friendly, community-first, plain-spoken",
  },
};


export function channelSpecBlock(channels: string[]): string {
  const valid = channels.filter((c): c is Channel => c in CHANNEL_SPECS);
  if (valid.length === 0) return "No channel selected — write channel-agnostic.";
  return valid
    .map((c) => {
      const s = CHANNEL_SPECS[c];
      return [
        `### ${s.label}`,
        `- Length: ideal ${s.ideal_chars[0]}–${s.ideal_chars[1]} chars, hard max ${s.max_chars}`,
        `- Structure: ${s.structure}`,
        `- Hook: ${s.hook_style}`,
        `- CTA: ${s.cta_style}`,
        `- Hashtags: ${s.hashtag_policy}`,
        `- Links: ${s.link_policy}`,
        `- Tone: ${s.tone_hint}`,
      ].join("\n");
    })
    .join("\n\n");
}
