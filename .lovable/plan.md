
# Require a real title for every draft

Today drafts can end up as "Untitled draft" in three ways:
1. `generateCreateDraft` auto-derives a title from the model output (or falls back to a seed slice) and never asks the user.
2. `saveCreateDraft` / `renameDraft` accept `title: null`.
3. `duplicateDraft` writes `"Untitled (copy)"` when the source has no title.
4. The UI (`DraftCard`, `create.index.tsx`, `generate-image.ts`) renders `"Untitled draft"` as a fallback.

Goal: a draft cannot exist without a human-entered title. If a title is missing, the app blocks the user in-flow and asks for one — no silent fallbacks anywhere.

## Changes

### 1. Server: reject empty titles
- `src/lib/create/create.functions.ts`
  - `SaveInput.title`: `z.string().trim().min(1).max(120)` (remove nullable).
  - `generateCreateDraft`: stop calling `deriveTitle`. Do NOT insert a new draft row until a title is supplied. Return the generated `sections` + a `pendingTitle: true` flag when no `draftId` was passed in; only persist when the client re-calls with `title`.
  - Delete the `deriveTitle` helper.
- `src/lib/drafts/drafts.functions.ts`
  - `renameDraft`: title becomes `z.string().trim().min(1).max(120)` (non-null).
  - `duplicateDraft`: require the source to have a title; new row title = `"${source.title} (copy)"`. If source somehow has none, throw a clear error so the UI can prompt.
- Add a one-off migration `NOT NULL` + `CHECK (length(btrim(title)) > 0)` on `create_drafts.title` and `drafts.title`. Backfill any existing rows with `title IS NULL OR title = ''` to `'Untitled — please rename'` first so the constraint can be added, then surface those rows in the UI as "needs a name" (see #3).

### 2. UI: "Name your draft" gate
- `src/routes/_authenticated/create.$formatId.tsx`
  - After a successful generation with `pendingTitle`, show a modal/inline field ("Name this draft") that must be filled before the save call is dispatched. Save/Regenerate/Archive buttons are disabled until a title exists.
  - Title input is also editable on already-saved drafts via the same header field (calls `renameDraft`).
- `src/components/drafts/DraftDetailSheet.tsx`
  - Existing rename field: enforce non-empty on blur, revert if empty.
- `src/components/create/shared/DecisionDock.tsx` (or the parent) — disable "Save" until title is set.

### 3. UI: kill every "Untitled" fallback
Replace hardcoded fallbacks with a "Needs a name" affordance that opens the rename input:
- `src/components/drafts/DraftCard.tsx` (line 71)
- `src/routes/_authenticated/create.index.tsx` (line 184)
- `src/routes/api/drafts/generate-image.ts` (lines 42, 76) — for image prompts, require the caller to have a title; if not, throw so the user is prompted client-side rather than shipping "Untitled draft" into the image prompt.
- `src/lib/drafts/drafts.functions.ts` line 496 (`"this draft"` fallback) can stay since title is now guaranteed; simplify to just `` `"${title}"` ``.

Note: `"Untitled"` fallbacks in **knowledge/entry** code paths (`EntryCard`, `knowledge.functions.ts`, `grounded-prompt.ts`, `ResumeConfirmSheet`, `injection.ts`, `context.server.ts`, `workspaces/actor.ts`) are out of scope — this rule is about **drafts**, not ingested knowledge entries whose titles come from external sources.

### 4. Suggested-title UX (so users aren't typing from scratch)
When generation completes, pre-fill the name field with the model's suggestion (what `deriveTitle` used to compute) but require the user to accept/edit it before Save is enabled. This keeps the friction low while guaranteeing an intentional title.

## Verification
- Build passes with the tightened Zod schemas.
- Create a new draft: Save button disabled until name entered; server rejects empty title.
- Rename to empty string: rejected, field reverts.
- Duplicate: new draft's title = `"<original> (copy)"`.
- Existing drafts list: no card shows "Untitled draft"; any legacy rows show "Needs a name" chip that opens rename.
