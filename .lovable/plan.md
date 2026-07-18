## Goal

Make Eve idiot-proof for Gen Z / millennial users: they cannot reach content creation, drafts, brain, library, or media without completing the four foundational pillars — **Voice → Knowledge → Domain → Audience** — in that exact order. Every step is guided, visual, celebratory, and impossible to skip or complete out of sequence.

## Current state (verified)

- `src/routes/_authenticated/onboarding.tsx` captures persona + domains + tone samples only — it does NOT set Voice, Knowledge Profile, Domain default, or Audience as first-class pillars. After finishing, the user lands on `/` with `missing: [voice, knowledge, domain, audience]`.
- `RequireDefaultsGate` exists but is only used by content-generation surfaces. Users can still browse Library, Media, Brain, Drafts, etc. without any pillars set, then hit a wall later.
- `useUserDefaults` already exposes the four pillars and `missing` — reuse everywhere.
- No enforced ordering: today a user could set Domain before Voice.
- No visible progress meter that persists in-shell.

## Plan

### 1. Rebuild `/onboarding` as a strict 4-step wizard (the "Setup Journey")

Replace the current 3-step persona/domains/tone flow with a 4-pillar guided setup, one pillar per step, in this locked order:

1. **Voice** — record 30-sec sample OR pick a system voice OR paste 3 writing samples. Creates + activates a voice.
2. **Knowledge** — upload 1+ document / paste bio / import LinkedIn / connect resume. Creates default `knowledge_profile`.
3. **Domain** — pick or type 1-3 expertise domains. Marks one as default.
4. **Audience** — AI-drafted ICP based on the previous 3 steps; user confirms or edits. Marks as default.

Each step:
- Big illustrated header + one-line "why this matters" explanation.
- Cannot advance until the pillar is actually saved server-side (verified via `useUserDefaults` invalidation, not local state).
- "Back" allowed; "Skip" removed entirely.
- Celebration micro-animation + haptic on completion.
- Progress bar shows `1 of 4 · Voice`.

### 2. Global route gate — no pillar, no app

Extend `src/routes/_authenticated/route.tsx` `beforeLoad`:

- Currently redirects to `/onboarding` only if `profiles.onboarded_at` is null.
- Add: if `onboarded_at` is set BUT any of the 4 pillars are missing (query the same 4 tables the client hook uses), redirect to `/onboarding?resume=<first-missing-slot>` — deep-linked to the exact incomplete step.
- Exceptions: `/onboarding`, `/settings/*`, `/auth`, `/terms`, `/privacy` remain reachable so users can fix defaults.

This closes the loophole where a user completed the old onboarding but never set the four pillars.

### 3. Persistent "Setup Journey" strip in the app shell

Add a slim, dismissible-only-when-complete progress strip at the top of `AppShell` (above `TopBar` on mobile, inline on desktop):

- Renders only while `useUserDefaults().ready === false`.
- Shows 4 dots labeled Voice · Knowledge · Domain · Audience with check/lock icons.
- Locked steps (out of order) are visibly greyed with a padlock — tapping shows a toast: "Finish {previous step} first."
- Tapping the active step deep-links to `/onboarding?resume=<slot>`.

### 4. Enforce ordering inside Settings too

The Settings pillar pages (`settings.voice`, `settings.knowledge`, `settings.domains`, `settings.audiences`) currently let a user open Audience before Voice.

- Add a lightweight `PillarLockGate` that wraps each pillar settings page: if any earlier pillar is unset, render a friendly redirect card ("Set your Voice first — takes 30 seconds") with a big CTA button, instead of the page contents.
- Order enforced: Voice → Knowledge → Domain → Audience.
- Once all four are set, the gate becomes a no-op and users can edit pillars in any order.

### 5. Upgrade `RequireDefaultsGate` copy + affordances

- Replace the checklist with the same 4-dot journey UI used in the shell strip (visual consistency).
- Primary CTA: **"Continue setup"** → `/onboarding?resume=<first-missing>`.
- Remove the current "jump to any settings page" links so users can't skip ahead.

### 6. Server-side belt-and-suspenders

- Extend `assertUserDefaults` (`src/lib/defaults/assert.server.ts`) to include `audience` and to return the *ordered* first-missing pillar in the error, so any direct server-fn call also enforces the sequence.
- Every content-generating server function already calls this — just adding audience + order.

### 7. Small UX polish

- Autosave each onboarding step on blur so a refresh never loses work.
- Add a "You're 3/4 done — 45 seconds left" nudge on step 4.
- Confetti + haptic on final completion, then route to `/create`.

## Files to edit

- `src/routes/_authenticated/onboarding.tsx` — full rewrite as 4-step pillar wizard with `?resume=` deep link.
- `src/routes/_authenticated/route.tsx` — extend `beforeLoad` to enforce pillar completion.
- `src/components/shell/AppShell.tsx` — mount new `SetupJourneyStrip`.
- `src/components/onboarding/SetupJourneyStrip.tsx` — new persistent progress component.
- `src/components/onboarding/PillarLockGate.tsx` — new gate for settings pillar pages.
- `src/routes/_authenticated/settings.voice.tsx`, `settings.knowledge.tsx`, `settings.domains.tsx`, `settings.audiences.tsx` — wrap contents in `PillarLockGate`.
- `src/components/settings/RequireDefaultsGate.tsx` — swap to journey UI + single "Continue setup" CTA.
- `src/lib/defaults/assert.server.ts` — include audience + ordered missing.
- `src/lib/onboarding/onboarding.functions.ts` — split into per-pillar save functions (`saveOnboardingVoice`, `…Knowledge`, `…Domain`, `…Audience`) so each step commits independently.

## Out of scope

- Redesigning individual pillar capture UIs (voice recorder, upload sheet, etc.) — reuse existing ones.
- Changing the pillar data model.
- Editing anything about content generation or drafts beyond the gates already in place.
