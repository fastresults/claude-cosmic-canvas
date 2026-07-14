/**
 * /create hub — format registry. Single source of truth.
 * Drives hub tiles, per-format pages, the Orb intent router, and quality UI.
 */

export type CreateCategory =
  | "long-form"
  | "sequence"
  | "speaking"
  | "short-form"
  | "campaign"
  | "research"
  | "media";

export type CreateMediaKind = "image" | "cover" | "video" | "slide";

export type MobileFlow = "seed-first" | "wizard" | "voice-first";

export type CreateFormat = {
  id: string;
  label: string;
  description: string;
  category: CreateCategory;
  defaultLength: number; // words
  mediaKinds: CreateMediaKind[];
  mobileFlow: MobileFlow;
};

/** Ordered by category, then label. */
export const CREATE_FORMATS: CreateFormat[] = [
  // Long-form
  { id: "press-release", label: "Press Release", description: "Newsroom-ready announcement.", category: "long-form", defaultLength: 500, mediaKinds: ["cover"], mobileFlow: "seed-first" },
  { id: "whitepaper", label: "Whitepaper", description: "Long-form authority piece.", category: "long-form", defaultLength: 2500, mediaKinds: ["cover", "image"], mobileFlow: "wizard" },
  { id: "lead-magnet", label: "Lead Magnet", description: "Gated PDF-style asset.", category: "long-form", defaultLength: 1500, mediaKinds: ["cover"], mobileFlow: "wizard" },
  { id: "case-study", label: "Case Study", description: "Customer story with outcomes.", category: "long-form", defaultLength: 1200, mediaKinds: ["cover"], mobileFlow: "seed-first" },
  { id: "op-ed", label: "Op-Ed", description: "Opinion piece with a POV.", category: "long-form", defaultLength: 900, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "bio", label: "Bio", description: "Short, medium, and long bios.", category: "long-form", defaultLength: 250, mediaKinds: ["image"], mobileFlow: "seed-first" },
  { id: "talking-points", label: "Talking Points", description: "Message map for interviews.", category: "long-form", defaultLength: 400, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "creative-brief", label: "Creative Brief", description: "Brief for creative teams.", category: "long-form", defaultLength: 500, mediaKinds: [], mobileFlow: "wizard" },
  { id: "brand-blueprint", label: "Brand Blueprint", description: "Positioning, voice, pillars.", category: "long-form", defaultLength: 1500, mediaKinds: [], mobileFlow: "wizard" },
  { id: "brand-assessment", label: "Brand Assessment", description: "Audit against goals.", category: "long-form", defaultLength: 1200, mediaKinds: [], mobileFlow: "wizard" },
  { id: "reputation-rehab", label: "Reputation Rehab", description: "Crisis + narrative reset.", category: "long-form", defaultLength: 1200, mediaKinds: [], mobileFlow: "wizard" },
  { id: "website-copy", label: "Website Copy", description: "Homepage / landing sections.", category: "long-form", defaultLength: 900, mediaKinds: [], mobileFlow: "wizard" },
  { id: "brochure-copy", label: "Brochure Copy", description: "Print-ready brochure.", category: "long-form", defaultLength: 700, mediaKinds: ["cover"], mobileFlow: "seed-first" },

  // Sequence
  { id: "email-sequence", label: "Email Sequence", description: "Multi-touch nurture.", category: "sequence", defaultLength: 1200, mediaKinds: [], mobileFlow: "wizard" },
  { id: "newsletter-sequence", label: "Newsletter Sequence", description: "Recurring newsletter arc.", category: "sequence", defaultLength: 1500, mediaKinds: [], mobileFlow: "wizard" },

  // Speaking / plans
  { id: "agenda", label: "Agenda", description: "Meeting or event agenda.", category: "speaking", defaultLength: 300, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "meeting-notes", label: "Meeting Notes", description: "Structured recap + actions.", category: "speaking", defaultLength: 500, mediaKinds: [], mobileFlow: "voice-first" },
  { id: "lesson-plan", label: "Lesson Plan", description: "Teach a topic in one session.", category: "speaking", defaultLength: 700, mediaKinds: [], mobileFlow: "wizard" },
  { id: "workshop-plan", label: "Workshop Plan", description: "Multi-hour interactive plan.", category: "speaking", defaultLength: 1000, mediaKinds: [], mobileFlow: "wizard" },
  { id: "event-plan", label: "Event Plan", description: "Full event runbook.", category: "speaking", defaultLength: 1200, mediaKinds: [], mobileFlow: "wizard" },
  { id: "event-space", label: "Event Space", description: "Venue layout + logistics.", category: "speaking", defaultLength: 500, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "webinar", label: "Webinar", description: "Deck outline + script.", category: "speaking", defaultLength: 1500, mediaKinds: ["slide", "cover"], mobileFlow: "wizard" },
  { id: "podcast", label: "Podcast", description: "Show plan + questions.", category: "speaking", defaultLength: 800, mediaKinds: ["cover"], mobileFlow: "wizard" },

  // Short-form
  { id: "freeform", label: "Freeform", description: "Anything, one prompt.", category: "short-form", defaultLength: 300, mediaKinds: [], mobileFlow: "voice-first" },
  { id: "freeform-interview", label: "Interview Q&A", description: "Freeform conversational format.", category: "short-form", defaultLength: 500, mediaKinds: [], mobileFlow: "voice-first" },
  { id: "quick-email", label: "Quick Email", description: "One email, one purpose.", category: "short-form", defaultLength: 200, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "conflict-resolution", label: "Conflict Reply", description: "Hard reply, kept human.", category: "short-form", defaultLength: 250, mediaKinds: [], mobileFlow: "voice-first" },
  { id: "youtube-script", label: "YouTube Script", description: "Hook + arc + CTA.", category: "short-form", defaultLength: 800, mediaKinds: ["cover"], mobileFlow: "seed-first" },
  { id: "article-from-notes", label: "Article from Notes", description: "Notes → publishable article.", category: "short-form", defaultLength: 900, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "post-content", label: "Social Post", description: "LinkedIn / X post.", category: "short-form", defaultLength: 220, mediaKinds: ["image"], mobileFlow: "voice-first" },

  // Campaign / research
  { id: "campaign-builder", label: "Campaign Builder", description: "Multi-asset campaign brief.", category: "campaign", defaultLength: 1500, mediaKinds: ["cover"], mobileFlow: "wizard" },
  { id: "company-research", label: "Company Research", description: "Structured company dossier.", category: "research", defaultLength: 1200, mediaKinds: [], mobileFlow: "seed-first" },
  { id: "classification-builder", label: "Classification", description: "Taxonomy / audience clusters.", category: "research", defaultLength: 800, mediaKinds: [], mobileFlow: "wizard" },
  { id: "influencer-activation", label: "Influencer Activation", description: "Plan + brief for creators.", category: "campaign", defaultLength: 1000, mediaKinds: [], mobileFlow: "wizard" },
  { id: "influencer-leads", label: "Influencer Leads", description: "Prospect list + hooks.", category: "campaign", defaultLength: 800, mediaKinds: [], mobileFlow: "seed-first" },

  // Media
  { id: "image", label: "Image", description: "AI image generation.", category: "media", defaultLength: 0, mediaKinds: ["image"], mobileFlow: "seed-first" },
  { id: "nano-banana", label: "Nano Banana Image", description: "Fast stylized image.", category: "media", defaultLength: 0, mediaKinds: ["image"], mobileFlow: "seed-first" },
  { id: "headshot", label: "Headshot", description: "Studio-style portrait.", category: "media", defaultLength: 0, mediaKinds: ["image"], mobileFlow: "seed-first" },
  { id: "cover-graphic", label: "Cover Graphic", description: "Post / article cover.", category: "media", defaultLength: 0, mediaKinds: ["cover"], mobileFlow: "seed-first" },
  { id: "preview-mockup", label: "Preview Mockup", description: "Device / product mockup.", category: "media", defaultLength: 0, mediaKinds: ["image"], mobileFlow: "seed-first" },
  { id: "sora2-video", label: "Sora2 Video", description: "Short generated video.", category: "media", defaultLength: 0, mediaKinds: ["video"], mobileFlow: "seed-first" },
  { id: "kling3-video", label: "Kling3 Video", description: "Alt provider video.", category: "media", defaultLength: 0, mediaKinds: ["video"], mobileFlow: "seed-first" },
];

export const CATEGORY_LABELS: Record<CreateCategory, string> = {
  "long-form": "Long-form",
  sequence: "Sequences",
  speaking: "Speaking & Plans",
  "short-form": "Short-form",
  campaign: "Campaigns",
  research: "Research",
  media: "Media",
};

const FORMAT_ID_ALIASES: Record<string, string> = {
  tweet: "post-content",
  "linkedin-post": "post-content",
  "x-post": "post-content",
  post: "post-content",
};

export function normalizeCreateFormatId(id: string): string {
  return FORMAT_ID_ALIASES[id] ?? id;
}

export function getFormat(id: string): CreateFormat | undefined {
  const normalizedId = normalizeCreateFormatId(id);
  return CREATE_FORMATS.find((f) => f.id === normalizedId);
}

export function formatsByCategory(): Array<[CreateCategory, CreateFormat[]]> {
  const out = new Map<CreateCategory, CreateFormat[]>();
  for (const f of CREATE_FORMATS) {
    const list = out.get(f.category) ?? [];
    list.push(f);
    out.set(f.category, list);
  }
  return Array.from(out.entries());
}
