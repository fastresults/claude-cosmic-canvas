## Goal

Make the Profile vs Preset distinction obvious the moment a user lands on either screen — no reading required — and guide first-time users through picking or building each one.

## The mental model we're teaching

- **Profile = "Who I am"** — persistent identity (Voice + Knowledge + Domain + Audience). One active at a time.
- **Preset = "How I want this piece to feel"** — a saved brief for one type of content (tone, format, length, angle, references).

Everywhere the two appear, we teach that split with the same words, same icons, same color coding.

## Concrete UX changes

### 1. Rename in the sidebar with subtitles

`Settings → Profiles` and `Settings → Presets` each get a one-line subtitle:
- Profiles — *"Your active identity"*
- Presets — *"Saved briefs for one piece"*

Icon coding: Profiles use a person/badge icon in accent; Presets use a document/lens icon in a distinct hue (e.g. warm amber). Same coding on the cards, the composer chips, and every reference to either concept.

### 2. Header explainer card (identical shape on both pages)

Top of each settings page, a two-column comparison card:

```
┌──────────────── PROFILE ────────────────┬──────────────── PRESET ─────────────────┐
│  Who you are right now                  │  How this piece should feel             │
│  Voice · Knowledge · Domain · Audience  │  Tone · Format · Length · Angle · Refs  │
│  One active at a time                   │  Pick per draft                         │
│  [You're here] on Profiles page         │  [You're here] on Presets page          │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

"You're here" highlights the current side. On mobile it stacks; the current side is full-color, the other is muted with a "See Presets →" / "See Profiles →" link.

### 3. Empty-state that guides, not just describes

Replace the current dashed-border placeholder with a 3-step guided card:

**Profiles empty state**
1. Pick your Voice → (opens Voice picker inline)
2. Pick your Knowledge base → (inline)
3. Pick your Audience → (inline)
Then a primary "Save as my first Profile" button. Domain is optional; audience gets a "Draft with AI" affordance since we already have that server function.

**Presets empty state**
1. What kind of piece? (LinkedIn post, essay, milestone, etc.)
2. What tone? (slider or 3–4 chips)
3. Who's it for? (audience picker — inherits from active Profile by default)
Then "Save as my first Preset."

### 4. Composer teaches by doing

In the composer's DefaultsStrip, the Profile pill and Preset pill sit side-by-side with distinct icons and a hairline divider between them. Long-press (or tap the info dot) shows a 1-line tooltip: *"Profile = who you are. Preset = the brief for this piece."*

New button on the composer overflow: **"Save this setup as…"** → sheet with two big cards:
- **Save as Profile** ("I'll want this identity again")
- **Save as Preset** ("I'll want this brief again")

Choosing one pre-fills the correct create sheet. This is the single most effective teaching moment.

### 5. Inherited-from-Profile pills inside Preset editor

When editing a Preset, Audience and Domain fields show as inherited chips pulled from the active Profile with a small "Override for this Preset" toggle. Makes it visually obvious that Presets *ride on top of* Profiles, not replace them.

### 6. Cross-links on cards

- Each Profile card gets a subtle footer: *"Most-used Presets in this profile: [chip] [chip] [chip]"*
- Each Preset card shows: *"Best paired with Profile: [chip]"*

Data comes from `preset_usage` join on last-active Profile.

### 7. First-run coach marks

First time a user visits either page, a dismissible tip sheet appears at the bottom with a two-panel diagram (Profile stack vs. Preset lens on top). One-tap dismiss, stored in `profiles.onboarding_flags`.

### 8. Copy audit — replace every conflicting sentence

Sweep all current copy that says "one-click bundles" for both and split:
- Profiles: *"Your identity, ready in one tap."*
- Presets: *"Your brief, ready in one tap."*

## Files touched

- `src/routes/_authenticated/settings.default-profiles.tsx` — header comparison card, guided empty state, cross-link footer, new copy
- `src/routes/_authenticated/settings.presets.tsx` — same header, guided empty state, inherited pills, cross-link footer, new copy
- `src/components/settings/DefaultsStrip.tsx` — icon + subtitle coding, info tooltip
- `src/components/shell/ComposerBar.tsx` (or the overflow menu) — new "Save this setup as…" entry + sheet
- `src/components/settings/ProfileVsPresetCard.tsx` — new shared explainer card
- `src/components/onboarding/FirstRunTip.tsx` — new dismissible coach mark component
- `src/hooks/useOnboardingFlags.ts` — new hook backed by `profiles.onboarding_flags` (already exists as jsonb) 
- Sidebar nav config — add subtitles

## What we're NOT doing

- No schema changes, no data migration
- Not merging the two concepts
- No changes to how the orchestrator consumes them (Profile audience already injects globally from last turn)

## Success signal

A new user should be able to answer, unprompted, after 10 seconds on either page: *"What's the difference?"* The header card + subtitle + coach mark are designed to make that answer trivial.