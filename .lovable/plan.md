## Problem

When a user opens a library item, the detail sheet header shows "Untitled draft" and a set of image slots. Two things confuse them:

1. **"Untitled draft" reads like a system state, not a label.** They think they must name it and hit Save before anything else works — but there is no name field and no Save button. In reality, the draft is already persisted; the title is just empty because the generator never set one.
2. **No clear "what do I do next" story.** The sheet offers Cover / Social / Inline / Polish / Schedule / Archive, but nothing tells the user this is their draft, that changes auto-save, or which single action to take next.

## Recommendation

Treat the sheet as an **already-saved draft workspace**, not a form. Fix the copy and add a lightweight title affordance so the header stops looking like an unfinished form field.

### Changes to `src/components/drafts/DraftDetailSheet.tsx`

1. **Replace the "Untitled draft" heading with an inline-editable title.**
   - When `draft.title` is null/empty, show placeholder text `Name this draft (optional)` in muted color instead of the alarming "Untitled draft".
   - Tap-to-edit → text input → blur/Enter saves via a new `renameDraft` server fn (or extend `updateDraftContext`). Auto-saves; no Save button.
   - Small pencil icon beside the title on desktop; tap-anywhere on mobile.

2. **Add a status/auto-save line under the title.**
   - Format: `Draft · Saved · 3m ago` (uses existing `status` and `updated_at`).
   - Makes clear this is persisted content, not an unsaved form.

3. **Rewrite the top "next step" banner into a clearer 1-2-3 progression.**
   - Step 1 done: content generated ✓
   - Step 2 (current): "Add a cover image so this is ready to share"
   - Step 3 (after cover): "Polish the copy, then schedule"
   - Only the current step is highlighted; completed steps show a check.

4. **Rename the action dock's "Archive" default position and add a primary "Ready to schedule" CTA** once a cover exists, so the user always sees the recommended next action.

### Changes to `src/lib/drafts/drafts.functions.ts`

- Add `renameDraft({ id, title })` server fn (auth-guarded, trims, max 120 chars, writes `create_drafts.title`). Invalidates `["draft", id]` and `["drafts"]`.

### Changes to `src/routes/_authenticated/library.tsx`

- In the list row, when `title` is set, show it as the primary line and the body preview as the secondary line (currently only body is shown). Encourages naming without requiring it.

### Copy changes only (no logic)

- "Add a cover image to make this shareable" → "Next: add a cover image so this post is ready to share."
- Section labels stay (COVER / SOCIAL / INLINE).
- Empty dropzone: "Generate or upload" → "Generate with AI or upload your own".

## Out of scope

- No new save/submit flow — the draft is already saved.
- No changes to image generation pipeline (recently landed).
- No changes to Schedule or Polish behavior.

## Verification

- Open a library item at 390×844: header shows editable title placeholder, status line, and a single highlighted next-step.
- Tap the title, type a name, blur → row in library reflects the new name after refetch.
- With a cover attached, the banner advances to the "Polish then schedule" step.
