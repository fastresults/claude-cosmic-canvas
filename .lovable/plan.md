## Problem

Orb labels can render generic type words ("Content", "Image", "Draft", "Knowledge", etc.) in two situations:

1. **Before the async `fetchLabel` resolves**, the node is seeded with `TYPE_PRETTY[type]` (e.g. `"Content"`, `"Image"`), so users briefly (or permanently, if the row lookup returns null) see the type word.
2. **When `fetchLabel` returns null** (missing row, missing title, unhandled type like `image`), the placeholder type word remains forever.

The rule the user wants: only the real descriptive title/filename/topic ever appears. Never a top-level type word.

## Fix

Edit `src/components/brain/three/useBrainGraph.ts`:

1. **Remove the `TYPE_PRETTY` seeding.** New nodes are inserted with `label: ""` (empty) instead of a type fallback. The `you` node keeps its label `"You"` (it's the user's own identity, not a type placeholder).
2. **Add an `image` case to `fetchLabel`** that reads `create_media` (title / prompt / filename, in that order) so image orbs resolve to a real descriptor.
3. **Harden every other case** to fall back through the best available descriptive field (e.g. `knowledge_entries.title` → `source_url` → `source_type` stripped; `create_drafts.title` only — never the format id word).
4. **Hide orbs with no label yet.** In `src/components/brain/three/Orb.tsx`, when `label` is empty, render the orb but skip the `<Html>` label entirely (no pill, no text). Once `fetchLabel` resolves and `setNodes` updates the label, the pill appears. If resolution fails, the orb stays label-less rather than showing a type word.
5. **Update `HealthView.tsx` and `palette.ts`** to remove any UI that prints the raw type word as a label. Type is still used for coloring/grouping, just never rendered as user-facing text.

## Result

- No orb ever displays "Draft", "Content", "Image", "Knowledge", "Domain", etc.
- Every visible label is the item's real title, filename, or topic.
- Orbs whose descriptor can't be resolved show no label at all (silent) instead of a generic type word.

## Files touched

- `src/components/brain/three/useBrainGraph.ts` — drop TYPE_PRETTY seeding, add `image` case, tighten fallbacks
- `src/components/brain/three/Orb.tsx` — skip label render when empty
- `src/components/brain/three/palette.ts` — remove type-word label usage (keep colors)
- `src/components/brain/views/HealthView.tsx` — remove type-word label usage
