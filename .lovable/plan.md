# Cycling Suggestion Pill

Replace the 4-row stack of suggestion pills on the home screen with a single pill that cycles through the same suggestions, saving vertical space.

## Scope
File: `src/routes/_authenticated/index.tsx` (empty-state block only).

## Behavior
- Keep the existing `SUGGESTIONS` array (4 items) as the source.
- Render **one** centered pill showing the current suggestion.
- Auto-advance every ~3.5s with a smooth fade/slide transition (framer-motion `AnimatePresence`, already a project dep).
- Pause cycling on hover/focus so the user can read/click.
- Clicking the pill calls `generate(currentSuggestion)` (same behavior as today).
- A tiny chevron (›) affordance on the right lets the user manually advance to the next idea without triggering generate.
- Respects `prefers-reduced-motion` (crossfade only, no slide).
- Accessible: `aria-live="polite"` on the text so screen readers announce changes; button has `aria-label="Try: {suggestion}. Tap to use, or tap arrow for next idea."`

## Implementation notes
- Add a small `useCyclingIndex(length, intervalMs, paused)` hook inline in the file (no new file needed).
- Use `motion.span` with `key={index}` inside `AnimatePresence mode="wait"` for the text swap.
- Preserve the `Pill` primitive styling (`variant="ghost"`, `size="sm"`) so visual language stays consistent.
- No changes to `SUGGESTIONS` content, `generate()`, or anything else on the page.

## Out of scope
- ComposerBar, Brain AskEveBar, or other suggestion surfaces.
- Adding/removing suggestions or wiring them to AI.
