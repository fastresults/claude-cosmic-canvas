# One-click defaults swap

## What exists today (and why the current answer is "no")

There are already two related concepts, but neither does what you're asking for:

1. **Defaults strip** (the "DEFAULTS" chips in your screenshot) — three independent chips (Voice / Knowledge / Domain) rendered by `DefaultsStrip.tsx`. Each is a separate `is_default = true` row on its own table. There is no single control that swaps all three at once.
2. **Presets** (`/settings/presets`) — reusable *content lenses*. A preset bundles **domains + audiences + brief_config + factor_weights + reference docs**, but it does **not** store a Voice or a Knowledge Profile. So today's "preset" ≠ "one-click voice + knowledge + domain".

So the feature you want is genuinely missing. And yes — since we already have Presets, we need a second, clearly-labeled concept for the three-defaults bundle.

## Naming (the "two forms of presets" question)

To avoid overloading the word "preset", I'd introduce:

- **Profile** — a one-click bundle of the three global defaults: Voice + Knowledge + Domain. Answers "who am I being right now?"
- **Preset** (existing, unchanged) — a content lens: domains + audiences + brief config + factor weights + reference docs. Answers "what angle am I writing from right now?"

Alternate labels if "Profile" collides with account/profile terminology: **Persona**, **Mode**, **Stack**, or **Setup**. My recommendation is **Profile** (or **Persona** if we want it to feel more voice-driven).

## Plan

### 1. Data

New table `default_profiles`:

- `id`, `user_id`, `name`, `description`, `emoji` or `icon`
- `voice_id` → `voices.id` (nullable)
- `knowledge_profile_id` → `knowledge_profiles.id` (nullable)
- `domain_id` → `domains.id` (nullable)
- `is_default boolean` (only one per user)
- `is_favorite`, `use_count`, `last_used_at`, timestamps

Standard RLS + GRANTs to `authenticated`. Partial unique index on `(user_id) WHERE is_default`.

### 2. Server functions (`src/lib/profiles/profiles.functions.ts`)

`listProfiles`, `createProfile`, `updateProfile`, `deleteProfile`, `setDefaultProfile`, `favoriteProfile`, and — the key one — **`applyProfile({ id })`**:

- Loads the profile
- In one transaction, flips `is_default` on the referenced Voice, Knowledge Profile, and Domain rows (clearing the previous defaults for each slot)
- Bumps `use_count` / `last_used_at`
- Invalidates the `useUserDefaults` query on the client

### 3. UI

**a. New chip in `DefaultsStrip.tsx`** — a leading "Profile" pill (before the three slot chips) showing the currently-applied profile name, e.g. `● Barack Obama Mode`. Clicking opens a popover listing the user's profiles; one click = `applyProfile` = all three slot chips update in place. A "Manage profiles" link at the bottom.

**b. New settings page `/settings/profiles`** — mirrors `settings.presets.tsx`:
- Grid of profiles with name + the three referenced slots shown as sub-chips
- Star to favorite, check to set default, delete
- "New profile" sheet with three dropdowns (Voice / Knowledge / Domain) sourced from existing hooks
- "Save as profile" quick action seeded from whatever is currently active in `useUserDefaults`

**c. Sidebar/settings nav** — add "Profiles" entry next to "Presets".

### 4. Terminology guardrails

- Keep **Presets** copy focused on content lenses ("lens", "angle", "reference material")
- Keep **Profiles** copy focused on identity ("who you're being", "voice + knowledge + domain in one click")
- Tooltip on each so users understand the difference at a glance

## Technical notes

- No changes to `voices`, `knowledge_profiles`, `domains` schemas — `applyProfile` just toggles their existing `is_default` columns.
- `useUserDefaults` stays the single source of truth for downstream surfaces (create, milestones, gate). Nothing else needs to change.
- `useActivePreset` (URL `?preset=`) is untouched; a matching `useActiveProfile` can follow the same pattern if we later want per-draft profile overrides.
- Migration includes CREATE TABLE + GRANTs + RLS + policies in one file, per project rules.

## Open question

Do you want the label **Profile**, **Persona**, **Mode**, or something else? I'll default to **Profile** unless you say otherwise.
