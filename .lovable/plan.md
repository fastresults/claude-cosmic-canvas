## Goal

One final craft-level pass on the setup experience so a Gen Z / millennial user *wants* to finish it — feels guided, rewarded, and never confused. Complements (does not replace) the gated 4-pillar system already in place.

## Current gaps (verified)

- `/onboarding` is still the legacy 3-step persona/domains/tone flow — it does not walk users through Voice → Knowledge → Domain → Audience as separate pillar steps. Users complete it and then get bounced to `/settings/voice` by the pillar gate, which feels like a second onboarding.
- No welcome/hero moment, no time estimate, no progress %, no "why this matters" for each pillar.
- No autosave between steps — a refresh mid-flow loses everything.
- No completion celebration (confetti, haptic, "you're ready" screen). User is dropped straight onto `/` with no context of what changed.
- `SetupJourneyStrip` is functional but visually thin — small pills, no progress bar, no "X seconds left" nudge, no illustrations.
- `RequireDefaultsGate` and `PillarLockGate` show a locked card but never show the user what the finished state will look like — no preview, no social proof, no example output.
- Toast copy on locked steps is generic ("Finish X first"). No personality, no reassurance.
- No inline help / examples inside each pillar page (users staring at "Add a voice" with no idea what a good input looks like).
- No "resume where you left off" — if a user closes the tab on step 3, next visit doesn't deep-link them back to Domain.
- Mobile: strip + DefaultsStrip + TopBar stack heavily on small screens; setup surfaces should hide the DefaultsStrip while setup is incomplete.
- Accessibility: locked buttons rely on toast only; no `aria-disabled`, no screen-reader announcement of the current step.

## Plan

### 1. Rewrite `/onboarding` as a true 4-pillar guided journey
- Replace the 3-step legacy flow with a warm hero screen ("Hey — let's set up Eve. Takes about 2 minutes.") + 4 pillar steps in order.
- Each step: big illustration, one-sentence "why", one-sentence "what happens if you skip" (spoiler: you can't), example inputs, and a live "before/after" mini preview when possible.
- Real progress bar with `Step 2 of 4 · 60% · ~90s left`.
- Autosave draft state to `localStorage` on every change; on remount, restore + deep-link to the first unmet pillar (`?resume=<slot>`).
- Each step commits its pillar server-side via the existing per-pillar save fns (from the prior plan). "Next" is disabled until commit succeeds — no way to advance on unsaved state.
- Confetti + haptic + a "You're ready. Here's what Eve can do now" screen on completion, then route to `/create` (not `/`).

### 2. Redesign `SetupJourneyStrip` for delight
- Full-width progress bar with animated fill + numeric %.
- Each pillar dot gets an icon, label, and micro-state (done ✓ / active pulse / locked 🔒).
- Adds a "~45 sec left" estimate and a single primary CTA ("Continue setup →") that always deep-links to the active pillar.
- Fades out with a celebratory animation when the fourth pillar is set, then unmounts.
- Hidden on `/onboarding` itself (redundant), `/auth`, `/terms`, `/privacy`.

### 3. Redesign `RequireDefaultsGate` and `PillarLockGate`
- Shared visual language: illustrated header, the 4-dot journey, a "Here's what unlocks when you finish" preview strip (thumbnails of Create / Brain / Library greyed with a shimmer).
- Warmer copy per pillar (e.g. Voice: "First — teach Eve how you sound. Record 30 seconds or paste 3 things you've written. No wrong answers.").
- Single primary CTA. Secondary link to "Why do I have to do this in order?" opens a small explainer sheet.
- Locked CTAs get `aria-disabled` + visually-hidden text ("Locked. Finish {previous} first.") for screen readers.

### 4. Hide competing chrome during setup
- While `useUserDefaults().ready === false`, `AppShell` hides `DefaultsStrip` (it's noise during setup) and hides the `ComposerBar` (nothing to compose against yet). Only `SetupJourneyStrip` + current page remain.
- `BottomNav` items for surfaces they can't use yet (Create, Brain, Library, Media, Queue) get a subtle padlock badge and, on tap, route to `/onboarding?resume=<first-missing>` instead of showing the gate card mid-nav.

### 5. Inline help + examples inside each pillar settings page
- Voice: sample recording waveform + "here's what a good 30-sec sample sounds like" 15-sec demo.
- Knowledge: three chips ("Paste bio", "Upload resume", "Import LinkedIn") each with a one-line example of the outcome.
- Domain: 8 suggested chips + "add your own" — cannot save 0.
- Audience: AI drafts the ICP from the previous 3 pillars automatically; user just confirms or tweaks — no blank textarea.

### 6. Resume + safety nets
- `/` respects `?resume=<slot>` when redirecting; strip's CTA always includes it.
- Any pillar save failure toasts with retry, never a silent revert.
- Add a one-time "Skip setup for now (limits what Eve can do)" escape hatch behind a confirm dialog — reserved for power users; default flow stays gated.

### 7. Copy + tone pass
- Rewrite every setup surface in second-person, warm, ≤14 words per sentence, zero jargon ("pillar" → "step", "ICP" → "audience", "curriculum vitae" → "what Eve knows about you").
- Toasts get personality ("Nice — voice locked in ✨", "One more step. You've got this.").

### 8. Accessibility + motion
- Setup screens get `aria-live="polite"` step announcements.
- Every locked control gets `aria-disabled="true"` and a hidden reason.
- Confetti + pulses respect `prefers-reduced-motion`.

## Files to edit

- `src/routes/_authenticated/onboarding.tsx` — full rewrite (4-pillar journey, autosave, `?resume=`, completion screen).
- `src/components/onboarding/SetupJourneyStrip.tsx` — visual redesign, progress bar, hide-list, exit animation.
- `src/components/onboarding/PillarLockGate.tsx` — new visual, preview strip, a11y.
- `src/components/settings/RequireDefaultsGate.tsx` — matches gate visual, single deep-link CTA.
- `src/components/shell/AppShell.tsx` — hide `DefaultsStrip` + `ComposerBar` while `!ready`.
- `src/components/shell/BottomNav.tsx` — padlock badge + deep-link redirect for gated tabs.
- `src/routes/_authenticated/settings.voice.tsx`, `settings.knowledge.tsx`, `settings.domains.tsx`, `settings.audiences.tsx` — inline help/examples, warmer empty states.
- `src/routes/_authenticated/index.tsx` — honor `?resume=<slot>`.
- New: `src/components/onboarding/CompletionCelebration.tsx` (confetti + haptic, respects reduced motion).
- New: `src/components/onboarding/WhyInOrderSheet.tsx` (explainer sheet).

## Out of scope

- Backend / schema changes.
- Content generation flows beyond the existing gates.
- Any redesign of Create, Brain, Library, Media surfaces themselves.
