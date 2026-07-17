
## Goal
Make `/settings/audiences` mobile-safe (no clipped controls) and guide novices to keep building their audience set after the first one lands.

## Problems observed
1. **Row overflow on mobile.** Each audience row in "Your audiences" is a single `flex` line: chevron + icon + long name (with inline "default" / "AI" pills) + "Set default" button + delete "X". On a 390px viewport the "Set default" pill and star get pushed past the right edge and clip. Root cause: the name span has no `min-w-0`, the pills are inline inside the same span so they can't wrap, and the action buttons aren't `shrink-0`.
2. **No "what next" cue.** After the first audience saves, the Add card collapses back to just the two buttons ("Draft next audience with AI" / "Add manually instead"). A novice doesn't know that audiences are meant to be a *set* (2–4 ICPs), that Eve will target the next-largest non-overlapping one, or that they can mark a different one as default later.
3. **Empty-state → filled-state transition is silent.** No confirmation, no "great, here's what to do next."

## Changes (UI only — `src/routes/_authenticated/settings.audiences.tsx`)

### 1. Mobile-safe audience row
Rework each `<li>` header into the responsive grid pattern from `responsive-layout-patterns`:

- Outer row: `grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2` (chevron | title block | actions).
- Chevron + Users icon become `shrink-0`.
- Title becomes its own `min-w-0` block with `truncate` on the name and pills moved to a **second line** underneath (`flex flex-wrap gap-1 mt-0.5`), not inline in the truncated span — so "default" / "AI" badges never fight the name for width.
- Actions column: collapse "Set default" text on mobile to an icon-only star button (`sm:inline` reveals the label at ≥640px), keep the "X" delete as icon-only. Both `shrink-0`, `aria-label` preserved.
- Add `overflow-hidden` on the `<li>` so nothing can bleed past the card edge.

### 2. Guidance for novice users
Add a small, always-visible helper block inside the "Your audiences" section, shown only when `audiences.length >= 1`:

- Above the list: one-line hint — "Most people target 2–4 audiences. Eve rotates content to fit whichever is active."
- Below the list: a subtle dashed "+ Draft another audience with AI" tile (same action as the top button, `onClick={draftNext}`) so the next-step affordance sits *at the end of the list* where the eye lands after reading it. Disabled + spinner while `suggest.isPending`.
- After a successful save, briefly show an inline success line in the Add card: "Saved. Draft another to broaden your reach, or set this one as default below." (auto-clears after ~4s via a `useEffect` timer, or on next interaction.)

### 3. Small polish
- "Add manually instead" link: give it a `+` icon and slightly more prominence (still secondary) so novices see it as an option rather than body text.
- Section heading: change "YOUR AUDIENCES" caption to include the count ("YOUR AUDIENCES · 1") — gives a quiet nudge toward growing the set.

## Out of scope
- No server / schema / prompt changes.
- No changes to the Add card's AI drafting flow itself (already AI-first).
- No changes to `DefaultsStrip` or other pages.

## Verification
- Playwright at 390×844: screenshot the audiences page with 1 and with 3 audiences; confirm no horizontal overflow, no clipped buttons, pills wrap under the name, "Draft another" tile visible at list end.
- Desktop (≥640px): "Set default" label reappears next to the star; layout unchanged from today otherwise.
