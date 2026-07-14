/** Milestone strategy — types and constants shared across client + server. */

export const CHANNELS = [
  "linkedin",
  "x",
  "blog",
  "press_release",
  "email",
  "podcast",
  "youtube",
  "event",
  "community",
  "instagram",
  "tiktok",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  linkedin: "LinkedIn",
  x: "X",
  blog: "Blog",
  press_release: "Press",
  email: "Email",
  podcast: "Podcast",
  youtube: "YouTube",
  event: "Event",
  community: "Community",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export type ChannelRole = "anchor" | "amplifier" | "proof" | "community";

export type PhasePlan = {
  window: { start_offset: number; end_offset: number };
  cadence_per_week: number;
  max_items: number;
  channels: Channel[];
  format_mix: { content_type: string; count: number; why: string }[];
  primary_message: string;
};

export type ChannelStrategyRow = {
  channel: Channel;
  role: ChannelRole;
  audience_fit: string;
  cap_per_week: number;
};

export type MilestoneStrategy = {
  thesis: string;
  target_outcomes: string[];
  phases: Partial<Record<"tease" | "announce" | "amplify" | "sustain", PhasePlan>>;
  channel_strategy: ChannelStrategyRow[];
  risks: string[];
};

export type ReleaseStatus =
  | "draft"
  | "scheduled"
  | "awaiting_approval"
  | "held_missing_day"
  | "approved"
  | "released"
  | "skipped";

export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  awaiting_approval: "Needs approval",
  held_missing_day: "Held · no date",
  approved: "Approved",
  released: "Released",
  skipped: "Skipped",
};
