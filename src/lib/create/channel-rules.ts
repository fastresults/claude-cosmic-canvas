/**
 * Channel-aware format rules for the Social Post format.
 * Injects per-channel structure/length/tone into [FORMAT_RULES] so a single
 * seed produces channel-native copy for one or many channels.
 */
import { CHANNEL_SPECS, channelSpecBlock } from "@/lib/workspaces/channelSpecs";
import type { Channel } from "@/lib/workspaces/strategy";

export const SOCIAL_CHANNELS: Channel[] = [
  "linkedin",
  "x",
  "instagram",
  "tiktok",
  "threads",
  "facebook",
];

export function isSocialChannel(c: string): c is Channel {
  return (SOCIAL_CHANNELS as string[]).includes(c);
}

export function normalizeSocialChannels(raw: unknown): Channel[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<Channel>();
  for (const v of raw) {
    if (typeof v === "string" && isSocialChannel(v)) seen.add(v);
  }
  return Array.from(seen);
}

const CHANNEL_SEP = "---CHANNEL---";

export function socialPostRules(channels: Channel[]): string {
  if (channels.length === 0) {
    // Safety fallback — should never happen; picker enforces selection.
    channels = ["linkedin"];
  }

  const specs = channelSpecBlock(channels);

  if (channels.length === 1) {
    const s = CHANNEL_SPECS[channels[0]];
    return [
      `Format: Social Post — native to ${s.label}.`,
      `Structure and voice for ${s.label}:`,
      specs,
      `Length: aim for ${s.ideal_chars[0]}–${s.ideal_chars[1]} characters; NEVER exceed ${s.max_chars}.`,
      `Output ONLY the post body for ${s.label}. No preamble, no channel label, no meta commentary.`,
    ].join("\n");
  }

  const labels = channels.map((c) => CHANNEL_SPECS[c].label).join(", ");
  return [
    `Format: Social Post — one seed adapted to multiple channels: ${labels}.`,
    `Per-channel specs:`,
    specs,
    `Write ONE post per channel, in this exact order: ${labels}.`,
    `Each post MUST be preceded by an H2 header of the channel label (e.g. \`## LinkedIn\`) and separated from the next post by a line containing ONLY \`${CHANNEL_SEP}\`.`,
    `Do NOT copy the same wording across channels — rewrite for each channel's native hook, length, cadence, and CTA. Respect the character caps.`,
    `No preamble, no closing commentary.`,
  ].join("\n");
}

/**
 * Split a multi-channel post response into one section per channel.
 * Falls back to a single section when the model didn't emit the separator.
 */
export function splitChannelSections(
  body: string,
  channels: Channel[],
): Array<{ heading: string | null; body: string }> {
  if (channels.length <= 1) {
    return [{ heading: channels[0] ? CHANNEL_SPECS[channels[0]].label : null, body: body.trim() }];
  }
  const parts = body.split(new RegExp(`^\\s*${CHANNEL_SEP}\\s*$`, "m"));
  if (parts.length === 1) {
    // Model didn't honor separator — try splitting on H2 labels.
    const labels = channels.map((c) => CHANNEL_SPECS[c].label);
    const re = new RegExp(`^\\s*##\\s+(${labels.join("|")})\\s*$`, "gim");
    const sections: Array<{ heading: string | null; body: string }> = [];
    let lastLabel: string | null = null;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      if (lastLabel !== null) {
        sections.push({ heading: lastLabel, body: body.slice(lastIndex, m.index).trim() });
      }
      lastLabel = m[1];
      lastIndex = m.index + m[0].length;
    }
    if (lastLabel !== null) {
      sections.push({ heading: lastLabel, body: body.slice(lastIndex).trim() });
    }
    if (sections.length > 0) return sections.filter((s) => s.body.length > 0);
    return [{ heading: null, body: body.trim() }];
  }
  return parts
    .map((p) => {
      const trimmed = p.trim();
      const headerMatch = trimmed.match(/^##\s+(.+?)\s*$/m);
      const heading = headerMatch ? headerMatch[1].trim() : null;
      const stripped = trimmed.replace(/^##\s+.+?\s*$/m, "").trim();
      return { heading, body: stripped };
    })
    .filter((s) => s.body.length > 0);
}
