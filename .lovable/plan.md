## The bottleneck

Confirmed from AI Gateway logs: recent `openai/gpt-5.6-sol` `chat_completions` runs are taking **104s and 108s** (log_ids `019f7596-…f906`, `019f7593-…2e1b`, both 2026-07-18). Those are the writer model calls that generate a draft.

That would be tolerable for the initial generation. It's **not** tolerable for "Save draft" — but that's exactly what's happening today.

### Why "Save" is slow

Flow in `src/routes/_authenticated/create.$formatId.tsx`:

1. User generates content → server returns `pendingTitle: true` with `sections` already in memory on the client.
2. User types a title, clicks **Save draft** → `confirmTitle()` calls `runGenerate(next)` (line 242).
3. `runGenerate` re-invokes `generateCreateDraft` on the server, passing the title.
4. `runGenerateCreateDraft` in `src/lib/create/create.server.ts` (lines 158–163) unconditionally calls `callAnthropic(...)` **again** with the same prompt before persisting.

So every "Save" pays for a full second LLM round-trip (~100s on gpt-5.6-sol) purely to re-produce content the browser is already holding. The DB insert at the end takes milliseconds; the model call is 99% of the wait.

Secondary friction:
- No optimistic UI on the Save button beyond "Saving…" — user has no ETA and nothing appears in the drafts list until the round-trip returns.
- On failure the in-memory sections stay, but the user has to click Save again and re-pay the round-trip.

## Fix

Split "generate" from "persist". Save should never call the model.

### 1. Client — `create.$formatId.tsx`

Replace `confirmTitle()` so that when we already have `sections` in memory (the `pendingTitle` case), it calls `saveCreateDraft` directly with those sections + the user's title, instead of `runGenerate(next)`:

```text
confirmTitle()
  if titlePending && sections.length:
     saveCreateDraft({ formatId, title, sections, briefSnapshot, workspaceId, workspaceItemId })
     → setCurrentDraftId, setTitle, clear titlePending
     → qc.invalidateQueries(["create-drafts"], ["workspace", …])
  else:
     runGenerate(next)   // only when there's genuinely nothing to persist
```

`saveCreateDraft` already exists in `src/lib/create/create.functions.ts` and accepts exactly this shape (title required, sections, briefSnapshot, workspaceId, workspaceItemId). No server change needed for the hot path.

### 2. Keep `briefSnapshot` around

Today `runGenerate` builds `briefSnapshot` on the server and doesn't return it. Add it to the `pendingTitle` response from `runGenerateCreateDraft` (`src/lib/create/create.server.ts`, both the generic path ~line 180 and the milestone-arc path ~line 356) so the client can pass it back to `saveCreateDraft`. Fallback: `null` — the column is nullable.

### 3. Guardrail on the server (defense in depth)

In `runGenerateCreateDraft`, if `data.title` is provided AND `data.draftId` is set AND the caller also sent `sections` — short-circuit before `callAnthropic`. Not required for the client fix above, but prevents any future caller from paying the model cost just to rename/persist. (Optional; can defer.)

### 4. UX polish (small)

- Disable the Save button and show a spinner immediately on click (already partly there via `savingTitle`).
- On success, keep the composed sections rendered so the transition to the saved state is instant instead of a flash of empty state.
- Toast "Draft saved" and route stays on the same URL with `currentDraftId` set.

## Expected impact

- Save latency drops from **~100s → ~200–400ms** (single Postgres insert + provenance edge write).
- No change to first-generation latency (that's the model's actual work).
- No schema changes. No new server functions required for the hot path.

## Files touched

- `src/routes/_authenticated/create.$formatId.tsx` — swap `runGenerate(next)` for `saveCreateDraft` in `confirmTitle`; thread `briefSnapshot` through local state.
- `src/lib/create/create.server.ts` — include `briefSnapshot` in the `pendingTitle` return payload (both generic and milestone branches).
- `src/lib/create/create.server.ts` (optional guardrail) — short-circuit when title+draftId+sections all present.

## Verification

- Generate a whitepaper → click Save with a title → confirm one insert row in `create_drafts`, no new AI Gateway `chat_completions` entry for that click, save completes sub-second.
- Confirm workspace-scoped saves still land with the right `workspace_id` / `workspace_item_id`.
- Confirm existing draft (currentDraftId set) rename path via `DraftTitleHeader` still works unchanged.
