## Approved: Option A — wire /library into DraftDetailSheet

Edit `src/routes/_authenticated/library.tsx` only. No schema, no new components, no changes to `/content/drafts`.

### Changes

1. Import `DraftDetailSheet` from `@/components/drafts/DraftDetailSheet`.
2. Replace `expanded` Set state with `openDraftId: string | null`.
3. `toggleExpand(id)` → in selection mode, still `toggleSelect(id)`; otherwise `setOpenDraftId(id)`.
4. Remove the inline `AnimatePresence` expansion block on each card (lines ~469–503) and the `isExpanded` branch on the preview line (~453–457) — always show the truncated preview.
5. Drop the `ChevronDown` affordance (no longer expanding inline).
6. Render `{openDraftId && <DraftDetailSheet draftId={openDraftId} onClose={() => setOpenDraftId(null)} />}` once near the page root.

### Result

Tapping any draft on `/library` opens the same detail sheet used by `/content/drafts`, which already renders Cover / Social / Inline image rows with Generate / Upload / Library tabs via `ImageAssociationSheet`, plus Polish, Schedule, Duplicate, Archive.

### Follow-up (not this turn)

Add a "Post now" button to `DraftDetailSheet`'s action dock to preserve the Post affordance previously shown inline on library cards.