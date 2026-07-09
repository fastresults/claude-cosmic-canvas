
## Goal
Stop auto-accumulating drafts in the Library. Generation on Home creates a single **working draft** the user can refine in place. Only "Save to drafts" persists it to the Library, and doing so clears Home so they can start fresh. Publish and Schedule move out of Home and live only in the Library.

## Flow (new)

```
Home:  speak/type ──► working draft (in memory)
                        │
                        ├── Regen / Tighten / Change tone  → overwrites same working draft
                        ├── Discard                        → clears Home
                        └── Save to drafts                 → inserts ONE row, clears Home
Library: shows saved drafts only → Edit / Regen / Schedule / Publish
```

No more "generate = library row". No duplicate rows on refinement. Home always shows at most one working draft.

## Changes

**1. `src/lib/content/content.functions.ts`**
- `contentDraft` (current name kept for compatibility) — **remove the DB insert and the provenance edges**. Return `{ body, usage, prompt, format }` only. This becomes the pure "generate text" call.
- New `refineDraft({ currentBody, instruction, format })` — Claude call that rewrites `currentBody` per instruction (`regen`, `tighten`, `tone:friendly`, free-form). Returns `{ body, usage }`. No DB write.
- New `saveDraft({ body, format, prompt, campaignId? })` — inserts one row with `status: "draft"`, writes the same provenance edges the old `contentDraft` used to write (`GENERATED_BY_TOOL` from `you`, optional `SPEAKS_IN` from active persona), returns the inserted draft.
- `listRecentDrafts` — unchanged (already filters by user via RLS); Library query stays the same.

**2. `src/routes/_authenticated/index.tsx` (Home)**
- Replace the "list all drafts" view with a single `workingDraft` React state: `{ body, format, prompt } | null`.
- On submit from `ComposerBar` (voice or text), call `contentDraft` and set `workingDraft` — do NOT invalidate `["drafts"]`.
- Render one `DraftCard` in **working** mode with actions: Regen, Tighten, Tone…, Discard, **Save to drafts** (primary). No Schedule / Post now here.
- Refine actions call `refineDraft` and overwrite `workingDraft.body` in place (streaming shimmer while pending).
- Save action calls `saveDraft`, then clears `workingDraft`, invalidates `["drafts"]`, and shows a small toast "Saved to Library". Empty state (Orb + suggestions) returns.
- Discard just clears `workingDraft` locally.

**3. `src/components/shell/ComposerBar.tsx`**
- Today `ComposerBar` owns the mutation and writes into the drafts table via `contentDraft`. Lift that out: expose an `onGenerate(prompt: string)` prop (Home passes the handler that sets `workingDraft`). Composer keeps mic/transcription logic but no longer touches the query cache.
- Voice path: on transcription success, call `onGenerate(text)` instead of `mutation.mutate`.
- No behavior change to mic permission UX.

**4. `src/components/primitives/DraftCard.tsx`**
- Add a `mode: "working" | "saved"` prop (default `"saved"` to keep Library behavior identical).
- `working` mode renders: Regen / Tighten / Tone chips (wired to `onRefine(kind)`), plus a footer with **Discard** (secondary) and **Save to drafts** (primary). No Schedule / Post now.
- `saved` mode renders the existing Schedule / Post now footer (used only by Library now).
- Props added: `onRefine?(kind: "regen" | "tighten" | "tone")`, `onSave?()`, `onDiscard?()`. Keep `onSchedule` / `onPublish` for saved mode.

**5. `src/routes/_authenticated/library.tsx`**
- No structural change; it already lists saved drafts via `listRecentDrafts`. Confirm the card renders in `saved` mode so Schedule / Publish remain here. (Publish wiring is unchanged — this plan does not add the publish backend, just ensures the button lives only in Library.)

## Data model
- No schema migration. `drafts.status` already exists; we simply stop inserting the pre-refinement rows. Existing rows in the table are untouched.
- Provenance edges (`brain_edges`) are still written — just at **save** time, not at generation time. Matches the "Second Brain records finalized artifacts" intent.

## Out of scope
- Streaming token-by-token refinement (current UX is shimmer + swap; fine for now).
- Undo history for refinements (single working buffer only).
- Publish backend (Schedule / Post now buttons in Library remain visual until publish is wired).
- Any change to onboarding, mic permission sheet, or Brain canvas.
