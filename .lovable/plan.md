# Channel-aware Social Posts

## The problem

Today `post-content` (Social Post) is one generic format described as "LinkedIn / X post." The prompt has no channel awareness — the same 220-word draft gets produced whether the user wants a tight X post (≤280 chars) or a LinkedIn narrative (900–1,400 chars). We already have rich per-channel rules in `src/lib/workspaces/channelSpecs.ts` (LinkedIn, X, Instagram, TikTok, Blog, Email, YouTube, Podcast, Press, Event, Community) — they're used by the workspace pipeline but never by `/create`.

## What we're building

Keep **Social Post** as one tile in the /create hub. On the Social Post page, add a **required Channel selector** above the seed input. Users can pick **one channel** (default flow) or toggle **multiple channels** (one adapted post per channel, generated in one click). Generation routes through the existing `CHANNEL_SPECS` so length, hook, CTA, hashtags, links, and tone match the channel natively.

## UX flow

**Single channel (default):**
1. Open Social Post → Channel chips row shows: LinkedIn · X · Instagram · TikTok · Threads · Facebook. First chip preselected from user's last-used channel (falls back to LinkedIn).
2. Header subtitle updates live: "Social Post · LinkedIn" and length hint "~900–1,400 chars."
3. Seed → Generate → single draft with channel-native structure. Draft title auto-prefixes with channel, e.g. "LinkedIn — Why remote-first is stalling."

**Multi-channel (one seed, many posts):**
1. User taps "Adapt for more" pill → chips become multi-select.
2. Generate produces N sections (one per channel) in the same draft, each with a channel heading and its own body sized to that channel's spec. Rendered in `StreamCanvas` as separate cards with copy-per-channel buttons.
3. Optional "Split into separate drafts" action on the Decision Dock creates one draft per channel from the multi-output result.

**Workspace integration:**
- When arriving from a workspace item that already has a `channel` field, that channel is preselected and locked to a single-channel run (workspace items own one channel each). A subtle "Set by workspace" note appears next to the picker.
- Multi-channel mode is disabled inside a workspace flow to keep 1 item = 1 draft.

**Defaults / memory:**
- New `last_social_channel` on the profile (or a lightweight `user_prefs` row) remembers the last single-channel choice per user.
- Distribution settings page (`settings.distribution.tsx`) already lists preferred channels — the picker respects that ordering and hides channels the user disabled.

## Workflow matrix — where this plugs in

| Entry point | Behavior |
|---|---|
| /create hub → Social Post tile | Channel picker required; single or multi-channel |
| Home Orb / voice intent "post about X" | Picker shown with LinkedIn preselected; user can change before generating |
| Workspace item (channel set) | Picker preselected + locked; single-channel only |
| Workspace item (no channel) | Picker required; single-channel; selection written back to the item |
| Regenerate on existing draft | Channel(s) preserved from the draft's brief_snapshot |
| Presets/Profiles | If a preset carries a `default_channel`, it hydrates the picker; user can still override |
| Distribution settings toggle off X | X hidden from the picker everywhere |

## Naming / tile copy

- Tile stays "Social Post," description changes to "One seed, native to each channel."
- Format-page subhead is dynamic: "Post for {Channel}" or "Post for {N} channels."

## Technical details

**Format registry (`src/config/createFormats.ts`):**
- Add optional `requiresChannel?: boolean` and `supportedChannels?: Channel[]` to `CreateFormat`.
- Mark `post-content` with `requiresChannel: true`, `supportedChannels: ["linkedin","x","instagram","tiktok","threads","facebook"]`.
- Add `threads` and `facebook` to `Channel` + `CHANNEL_SPECS` in `src/lib/workspaces/channelSpecs.ts` (Threads mirrors X with 500-char cap; Facebook mirrors LinkedIn with lighter tone).

**Format page (`src/routes/_authenticated/create.$formatId.tsx`):**
- New `<ChannelPicker>` component (mobile-first chip row + "Adapt for more" toggle).
- Reads workspace item's channel via existing `useWorkspaceContext` and locks when present.
- Persists selection in URL search param `channel=linkedin` (or `channels=linkedin,x`) so the state survives refresh and share-links.
- Adds `channels: string[]` to `GenerateInput`; blocks Generate until at least one is chosen.

**Generation (`src/lib/create/create.functions.ts` + `format-rules.ts`):**
- `GenerateInput` accepts `channels: z.array(z.enum([...])).min(1).max(6)`.
- New `channelAwareFormatRules(format, channels)` (in a new `src/lib/create/channel-rules.ts`) that:
  - For 1 channel: embeds that channel's spec block from `channelSpecBlock([channel])` and instructs "Output ONLY the post body for {Channel}."
  - For N channels: embeds all specs and instructs "Output one post per channel, each preceded by `## {ChannelLabel}` and separated by `---CHANNEL---`."
- `splitSections` gets a new branch for `post-content` with multi-channel output: split on `---CHANNEL---`, use the `##` heading as `section.heading`.
- `brief_snapshot` stores `{ channels: [...] }` so regenerate/rename flows keep context.
- Title suggestion prompt is nudged with the primary channel so the auto-suggested name reads native (e.g. LinkedIn titles allow longer phrases; X titles stay punchy).

**Draft rendering:**
- `StreamCanvas` already renders sections with headings — multi-channel drafts naturally get one card per channel. Add per-section copy button in `src/components/create/shared/StreamCanvas.tsx` (nice-to-have; ships if trivial).

**Data:**
- No new tables. Add nullable `last_social_channel text` column to `profiles` in a migration; write on every successful single-channel generate.
- Extend `create_drafts.brief_snapshot` shape (JSON, no schema change) to include `channels`.

**Aliases:** existing `FORMAT_ID_ALIASES` (`linkedin-post`, `x-post`, `tweet`) all still resolve to `post-content`; when arriving via those aliases, preselect the matching channel and skip the picker step (jump straight to seed).

## Out of scope for this pass

- Auto-scheduling/publishing per channel (Distribution surface handles that separately).
- Image sizing per channel (media formats are their own tiles).
- Reels/Shorts video scripts — `youtube-script` and future tiktok-script tile cover those.
