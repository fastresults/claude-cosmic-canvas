## Rule

**Every saved content item lives in exactly one library:**
- `workspace_id IS NULL` → **General Library** (`/library`)
- `workspace_id IS NOT NULL` → **Milestone Library** (scoped to that workspace)

No item appears in both. Placement is derived at read time from `create_drafts.workspace_id` — no schema change, no dual-write, no per-format allowlist to maintain.

## Current state (verified)

- `create_drafts` already carries `workspace_id` (nullable). Rows split cleanly today: 8 workspace-bound (`post-content`, `email-sequence`, `press-release`, `op-ed`, `case-study`) and 7 general (`post-content`, `post`, `company-research`, `article-from-notes`).
- `src/lib/create/create.server.ts` already writes `workspace_id: data.workspaceId ?? null` on every insert. `saveDraft` (just migrated) writes it from `readWorkspaceContext()`. So the save side is already correct — the leak is on the **read** side: `searchDrafts` in `src/lib/library/library.functions.ts` returns everything regardless of `workspace_id`, so milestone items show up in the general Library.

## Changes

1. **`src/lib/library/library.functions.ts` — `searchDrafts`**
   - Add `scope: z.enum(["general", "milestone", "all"]).default("general")` to `SearchInput`.
   - Apply at query time:
     - `general` → `.is("workspace_id", null)`
     - `milestone` → `.not("workspace_id", "is", null)` (optionally `.eq("workspace_id", filters.workspaceId)` when a specific milestone is scoped)
     - `all` → no filter (kept for admin/debug; not exposed in UI)
   - Include `workspace_id` in the SELECT and in the returned row shape so the UI can badge milestone items.

2. **`src/routes/_authenticated/library.tsx` — add Milestone tab**
   - Two tabs at the top of Library: **General** (default) and **Milestones**.
   - Tab state lives in the URL (`?scope=general|milestone`) via `validateSearch`, so it's shareable and preserves back/forward.
   - Passes `scope` into the `searchDrafts` call.
   - Milestone tab groups results by workspace title (fetch `opportunity_workspaces.title` for the distinct `workspace_id`s on the page) and each group header links to `/workspaces/$id`.

3. **`src/routes/_authenticated/workspaces.$id.tsx`** — nothing to change functionally, but confirm the workspace detail view already lists its items via `workspace_items` / `create_drafts.workspace_id`. Add a small "Open in Library" link that deep-links to `/library?scope=milestone&workspaceId=<id>` for consistency.

4. **Recent Drafts strips (Create hub, Home)** — audit and filter to `workspace_id IS NULL` so the "general" surface never previews milestone items. Files to touch: any caller of `listRecentDrafts` that renders on general surfaces (`src/lib/content/content.functions.ts` — add `.is("workspace_id", null)` there, since that helper feeds the general Recent Drafts strip).

5. **Save-time enforcement (defensive)** — no code change required today because both `saveDraft` and every format flow already propagate `workspaceId`/`readWorkspaceContext()`. Add a short comment in `saveDraft` and `create.server.ts` documenting the rule so future formats don't accidentally drop `workspace_id`.

## Out of scope

- No new table, no data migration — existing rows are already partitioned correctly by `workspace_id`.
- Not changing Milestone workspace UIs; only adding a Library view onto the same data.
- Not touching `drafts` (legacy) — it's read-only per the previous consolidation.

## Verification

- `/library` (default) shows only rows with `workspace_id IS NULL` — the two `post` rows and the `company-research` row appear; the `press-release`, `op-ed`, `case-study`, `email-sequence` milestone rows do not.
- `/library?scope=milestone` shows the workspace-bound rows, grouped by workspace title, each linking back to its milestone.
- Saving a quick post from the Home orb (no milestone context) lands in General.
- Saving from inside a Milestone workspace lands in that Milestone's library and is absent from General.
