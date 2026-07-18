# Make Audience Selection Obvious

## Problem
The "active" audience is currently set via a small `⭐ Set default` icon on the right side of each row. On mobile the label is hidden, the star is easy to miss, and the whole card doesn't behave like a selectable item — users don't realize they can pick which audience is active.

## Fix (single file: `src/routes/_authenticated/settings.audiences.tsx`)

### 1. Card becomes the selector
- Whole card is a radio-style selectable surface.
- Active audience: thick accent border + subtle accent tint + persistent "Active" pill (replaces the small "default" chip).
- Inactive audience: normal border, hover shows accent border + a faint "Tap to activate" hint on the right.
- Clicking anywhere on the card header (name area) activates it. The chevron continues to expand/collapse details.

### 2. Explicit visual affordance
- Left of the name, show a filled ●/○ radio dot (accent when active, muted ring when not). This makes "one-of-many selection" instantly readable.
- Remove the standalone `Set default` icon button — activation is now the primary card action.

### 3. Clear section framing
- Rename the section heading from "Your audiences" to "Active audience · tap to switch".
- Sub-caption: "Eve uses your active audience for every draft. Switch anytime."
- Above the list, add a one-line current-active summary: "Active: **{name}**" so it's visible even when a card is collapsed and the list is long.

### 4. Keep destructive/expand actions clear
- Chevron (expand) and X (remove) stay on the right, unchanged.
- Add `role="radiogroup"` on the list and `role="radio" aria-checked` on each row for a11y.

### 5. Feedback
- On tap, optimistic update + toast: "Now targeting {name}".
- Haptic tick on mobile (existing `haptics` util if present; otherwise skip).

## Out of scope
- No schema changes (already have `is_default` per audience).
- No changes to Profiles/Defaults strip (the Audience pill there already reflects the default).
- No changes to draft/rename/AI flows.
