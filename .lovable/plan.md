## Root cause (verified)

The "Perils of AI" post you just saved **is** in the database — but in the wrong table.

- Found: `drafts` row `07220c02-41a4-4bf9-af71-19787281f014`, `format='post'`, body starts with "AI can sound calm, certain, and endlessly available… That does not make it a therapist. For someone experiencing paran…", `created_at` 2026-07-17 16:59:56 UTC (matches "less than 3 minutes ago").
- Library reads from `create_drafts` only (`src/lib/library/library.functions.ts` → `searchDrafts`), so the row is invisible there.

The app has two draft tables from two eras:
- Legacy `drafts` — written by `saveDraft` in `src/lib/content/content.functions.ts` (used by the working-draft / Home-orb quick-post flow via `src/lib/content/working-draft.tsx`), and by an orchestrator tool in `src/lib/orchestrator/tools/index.ts`.
- New `create_drafts` — written by every format flow in `src/lib/create/create.server.ts`, and read by Library, Content → Drafts, Create hub tiles, workspaces, scheduler.

The "Perils of AI" post came through the legacy quick-post path, so it landed in `drafts` and every modern surface (Library, Create hub, Content → Drafts) missed it.

## Fix — consolidate on `create_drafts`

Single source of truth. Legacy `drafts` becomes read-only (kept for old rows / Brain edges).

1. **Rewrite `saveDraft`** in `src/lib/content/content.functions.ts` to insert into `create_drafts` instead of `drafts`:
   - Map fields: `format → format_id`, `body → sections: [{ heading: null, body }]`, add `title: null`, `status: 'draft'`, `user_id`, `campaign_id`, and pick up `workspace_id` / `workspace_item_id` from `readWorkspaceContext()` (matches the pattern used by `create.server.ts`).
   - Keep the returned shape backwards-compatible for `working-draft.tsx` (return `{ draft: { id, format, body, score, status, created_at } }` synthesized from the new row).
   - Keep the provenance edge write (`writeEdgesServer`) unchanged — `dstType: 'draft'`, `dstId: newRow.id`.
2. **Update the orchestrator tool** in `src/lib/orchestrator/tools/index.ts` (line 64 `from("drafts")` insert) to write to `create_drafts` the same way, so tool-authored drafts also show up.
3. **Point `listRecentDrafts`** at `create_drafts` (filter `status='draft'`, project to the same legacy shape the callers expect).
4. **Backfill the orphan** — one migration that copies any `drafts` rows created in the last 7 days that don't already have a matching `create_drafts` row (match on `user_id + body`) into `create_drafts` with `format_id = format`, `sections = [{heading:null, body}]`, preserving `created_at` and `campaign_id`. This surfaces the "Perils of AI" draft and any other recent stragglers without touching historical rows.
5. **Leave `useBrainGraph.ts`** reading legacy `drafts` alone for now (Brain view over historical nodes) — mark with a `TODO` to migrate once legacy rows are dual-written or migrated.

Not doing: dual-writing to both tables (invites drift), or teaching Library to union both tables (perpetuates the split).

## Verification

- Save a post from the Home orb quick-post → appears at top of `/library` and on Create hub tiles immediately.
- After migration runs, "Perils of AI" (id `07220c02…`) is visible in Library sorted first under "Today".
- No format/flow that previously produced a `drafts` row still bypasses `create_drafts`.
