# Fix: Draft sheet action dock hidden behind bottom nav

## Problem
In `DraftDetailSheet`, the sticky action dock (Polish / Image / Schedule / Archive) sits at the bottom of a sheet rendered at `z-40`. The app's `BottomNav` is also `fixed bottom-0 z-40`. Same stacking level + later DOM position means the nav paints on top of the dock, so those primary actions are unreachable.

The sheet is meant to be a modal surface stacked above the app shell, not an inline panel that shares space with the nav.

## Fix (presentation-only, scoped to the sheet)

**`src/components/drafts/DraftDetailSheet.tsx`**

1. Raise the sheet above the app chrome.
   - Overlay container: `z-40` → `z-50` (matches `EveSheet` convention).
   - This makes the overlay cover `BottomNav` (`z-40`), so nothing shows through underneath.

2. Make the sticky action dock respect the iOS safe area so it doesn't clip on notched devices now that it's no longer sharing space with the nav.
   - Add `style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}` to the dock.
   - Add matching bottom padding to the scroll region (`pb-24` → `pb-32`) so content isn't hidden under the dock.

3. Same z-index bump for the loading and not-found shells (they use the same `SheetShell`), so bump `SheetShell` itself from `z-40` → `z-50`. `ImageAssociationSheet` and `SchedulePicker` already use `EveSheet` at `z-50`, so they'll continue to stack correctly above the draft sheet.

## Why this over alternatives

- **Hiding `BottomNav` when the sheet opens**: requires lifting sheet state into `AppShell` or a global store; larger blast radius for a visual bug.
- **Adding `bottom-16` to the dock to sit above the nav**: leaves the nav visible behind a modal surface, which is inconsistent with every other sheet in the app (`EveSheet` overlays everything at `z-50`).

## Out of scope
No changes to `BottomNav`, `AppShell`, business logic, or any other sheet. No copy changes.
