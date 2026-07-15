
# Inline draft rename + AI title suggestion

On `/create/$formatId?draftId=…`, the draft title (e.g. "Untitled — please rename") currently renders as static text with no way to change it. Add an inline rename affordance and an AI "suggest title" button that surveys the sections and returns a concise ≤5-word title.

## Changes

### 1. New server function: `suggestDraftTitle`
- File: `src/lib/create/create.functions.ts`
- Input: `{ draftId: uuid }`.
- Handler:
  - Load the draft (`title`, `sections`, `format_id`) under RLS.
  - Flatten sections into a plain-text summary (reuse the same shape used by `generateImageConcepts` — heading + body, capped at ~2000 chars).
  - Call `callAnthropic` with a tiny system prompt: "Return ONLY a title of 5 words or fewer, Title Case, no punctuation, no quotes, no trailing period. Capture the piece's core point."
  - Post-process: trim, strip surrounding quotes/markdown, collapse whitespace, hard cap at 5 words and 60 chars. If empty after cleaning, throw a clear error the UI can surface.
  - Return `{ title: string }`. Does NOT persist — the client applies it via existing `renameDraft`.
- No new deps, no migration.

### 2. Inline rename UI in the draft header
- File: `src/routes/_authenticated/create.$formatId.tsx`
- Replace the static `<h2>{title}</h2>` with a small `DraftTitleHeader` component (defined in the same file or `src/components/create/DraftTitleHeader.tsx` for reuse):
  - Read mode: title text + pencil icon (click to edit) + sparkles/wand icon "Suggest title" (only enabled when `sections.length > 0`).
  - Edit mode: text input (autoFocus, maxLength 120), Enter = save, Esc = cancel, blur = save. Empty input reverts (matches the new "no blank names" rule).
  - Save calls existing `renameDraft` server fn via `useServerFn`; on success, updates local `title` state and invalidates `["create-drafts"]`.
  - Suggest button:
    - Calls `suggestDraftTitle` with `currentDraftId`.
    - While pending: swap icon for spinner, disable.
    - On success: drop the returned title into the edit input (enter edit mode automatically with the suggestion pre-filled) so the user can accept with Enter or tweak first — no silent overwrite.
    - On error: surface the message via the existing `error` state.
- Also expose the same rename+suggest control **on the naming gate for new drafts**: the sparkles button next to the "Name this draft" input calls a variant that uses the in-memory `sections` (see #3) so users can accept the AI suggestion before first save too.

### 3. Suggestion for un-persisted drafts
- `suggestDraftTitle` accepts either `{ draftId }` (existing draft) or `{ sections }` (client-side content not yet saved). Validator = discriminated union. Same prompt + post-processing.
- The naming gate wires the sparkles button to the `sections` variant.

### 4. Keep the same behavior in `DraftDetailSheet`
- File: `src/components/drafts/DraftDetailSheet.tsx` already has inline rename. Add the same sparkles "Suggest title" icon next to the pencil, calling `suggestDraftTitle({ draftId })` and pre-filling the edit input.
- No other behavior change.

## UX details
- Icons: `Pencil` (already imported in DraftDetailSheet) and `Sparkles` from `lucide-react`.
- Tooltip / aria-label on the sparkles button: "Suggest a title from the content".
- Suggestion never auto-saves; the user always confirms with Enter or the save button. This keeps titles intentional per the "no auto-titled drafts" rule.
- Cost guard: 5-word cap is enforced client-side too so a chatty model response still gets trimmed.

## Verification
1. Open a resumed draft with title "Untitled — please rename": click pencil → input appears → type → Enter saves; card in `/create` list updates.
2. Click sparkles: spinner → input becomes editable with a ≤5-word suggestion pre-filled → Enter saves.
3. New draft flow: generate → naming gate shows sparkles → click → suggestion appears in the input.
4. Blank rename reverts. Server rejects empty per existing rule.
