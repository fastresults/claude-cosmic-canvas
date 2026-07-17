## Goal

Make "Add audience" AI-first: clicking to add always drafts the **next-best ICP that does not duplicate any existing audience**, ranked by market size / relevance to the user's domain and knowledge.

## Behavior

- The blank-input "Add audience" path is removed as the default. The primary CTA becomes **"Draft next audience with AI"** (a single button that replaces today's "Suggest with AI" + "Generate & save" split).
- On click:
  1. Server gathers domain + knowledge context (already implemented) **plus the list of existing audience names + one-line persona summaries**.
  2. AI is instructed to propose the **next-largest, highest-value ICP** for this creator that is meaningfully distinct from every existing audience — no overlaps in persona, roles, or industries.
  3. Drafted audience is shown inline (name + description + ICP preview) with **Save** / **Discard** / **Regenerate** actions. Nothing writes to the DB until the user clicks Save.
- Manual entry is still possible but demoted: a small "Add manually" link below the AI CTA reveals the blank name/description inputs. This keeps the flow AI-first without losing the escape hatch.
- On save, the new audience is appended; subsequent "Draft next" clicks see it in the existing list and pick the *next* gap.

## Server changes (`src/lib/audiences/audiences.functions.ts`)

1. Extend `SuggestInput` with an optional `existing` array: `{ name, persona?, role_titles?, industries? }[]`. Default to the caller's audiences when not provided.
2. In `suggestAudienceFromContext.handler`, if `existing` is not supplied, fetch the user's audiences (name + `icp.persona`, `icp.role_titles`, `icp.industries`) and use that.
3. Update the `system` prompt to make the ranking + de-dup rule explicit:
   - "Propose the **next most valuable ICP** for this creator, ranked by addressable size, buying intent, and fit with the domain and knowledge."
   - "It MUST be meaningfully distinct from every audience already listed — no overlapping persona, role titles, or industries. If an obvious high-value ICP is already covered, pick the next-best gap."
   - "If every strong ICP is already covered, return a narrower **sub-segment** of an under-served vertical rather than a duplicate."
4. Include the existing audiences in the user prompt as `Existing audiences (do not duplicate):\n- <name>: <persona> [roles: …] [industries: …]`.
5. Post-generation guard: if the drafted `name`, `persona`, or `role_titles` collide (case-insensitive) with an existing audience, re-run the AI **once** with an added "the previous suggestion `<x>` duplicated `<y>` — pick a different segment" nudge. If still duplicate, return anyway but flag `is_duplicate_warning: true` in the response so the UI can warn.
6. `generateDefaultAudience` already calls `suggestAudienceFromContext({ data: {} })` — it now automatically benefits from de-dup.

## UI changes (`src/routes/_authenticated/settings.audiences.tsx`)

1. Replace the two-button header ("Suggest with AI" + "Generate & save") with a single primary button: **"Draft next audience with AI"** (uses the existing `suggestFn`).
2. Hide the name/description inputs by default. Show them only after:
   - AI has drafted (pre-filled + editable), or
   - the user clicks a subdued "Add manually" link.
3. After a draft appears, show **Save**, **Regenerate**, **Discard** buttons. Regenerate re-calls `suggestFn` (which now excludes existing + the just-discarded draft via a client-side `existing` extension).
4. If server returns `is_duplicate_warning`, show a small amber warning: "This may overlap with `<name>`. Regenerate or edit before saving."
5. Empty-state copy updates: "No audiences yet. Draft your first ICP with AI." with the same primary button.

## Out of scope

- No DB schema changes.
- No changes to `applyDefaultProfile`, prompt injection, or brain edges.
- The `generateDefaultAudience` one-click path stays for the initial-setup gate; it now inherits de-dup for free.

## Verification

- Add one audience manually, then click "Draft next" → new suggestion has a different persona/roles/industries.
- Click "Draft next" three times in a row (saving each) → third suggestion is a distinct sub-segment, not a repeat of the first two.
- Server log shows the `Existing audiences` block in the prompt when `[audiences] suggest` runs.
