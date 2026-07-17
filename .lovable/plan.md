## Goal
In the Library's **Milestones** tab, each milestone (workspace) group must be collapsed by default and expand only when the user taps its header.

## Scope
Frontend/presentation only — `src/routes/_authenticated/library.tsx`. No changes to server functions, schema, or the General tab behavior.

## Changes

1. **Collapsible state per group** (milestone scope only)
   - Add `const [expanded, setExpanded] = useState<Record<string, boolean>>({})` keyed by group label (workspace title).
   - Default = collapsed (empty map → falsy → collapsed).
   - Reset the map when `scope` changes so switching tabs starts fresh.

2. **Group header becomes a button** (only when `scope === "milestone"`)
   - Wrap the existing sticky header row in a `<button>` with `aria-expanded`, `aria-controls`.
   - Add a chevron icon (`ChevronRight` rotates to `ChevronDown` when expanded) on the left.
   - Keep the existing icon/label/count layout intact; just make it interactive and full-width.
   - Preserve current styling (sticky, backdrop blur, uppercase tracking).

3. **Conditional item list render**
   - Render the `items.map(...)` block only when `expanded[group]` is true **or** when `scope !== "milestone"` (General tab remains always-visible, unchanged).
   - Show a small count-only summary line ("Tap to view N items") in the collapsed state is not needed — the count already appears in the header.

4. **Auto-expand on search**
   - If the user has an active query `q` or any active filter chips, auto-expand all milestone groups so search results aren't hidden. Implement by treating groups as expanded when `q.trim().length > 0 || activeChips.length > 0`.

5. **Deep link** (nice-to-have, low risk)
   - If `workspaceId` search param is present, auto-expand only that workspace's group on mount.

## Non-goals
- No changes to General tab grouping (date-based groups stay always-visible).
- No animation library additions — a simple CSS transition on the chevron rotation is enough.
- No changes to selection mode, sort, or bulk actions.

## Verification
- Milestones tab loads with all groups collapsed, chevrons pointing right, counts visible.
- Tapping a header expands that group only; tapping again collapses.
- Typing in the search bar reveals matching items across groups.
- General tab is visually unchanged.
