## Root cause (verified)
- `opportunity_workspaces.completed_items` for this milestone is stored as `0`, while all 7 rows in `workspace_items` are `status='ready'` with `content_generation_id` set (drafts exist).
- Nothing writes `completed_items` back when items become `ready`/`scheduled`/`published`, so the ring is always `0/total_items` unless a code path (that doesn't run for auto-drafted items) increments it.
- The `ProgressRing` in `workspaces.$id.tsx` reads `w.completed_items` directly, so the stale DB value is what renders.

## Fix
Derive progress from the real item statuses instead of trusting the stored counter.

**1. `src/lib/workspaces/workspaces.functions.ts`**
- `listWorkspaces`: after fetching rows, do one grouped query on `workspace_items` for those workspace IDs (`workspace_id, status`) and compute `completed_items = count(status IN ('ready','scheduled','published','completed'))` and `total_items = count(*)`. Override those two fields on each row before returning.
- `getWorkspace`: after loading items, override `ws.total_items = items.length` and `ws.completed_items = items.filter(i => ['ready','scheduled','published','completed'].includes(i.status)).length` before returning.
- Keep the DB columns as-is (no migration) — the derived values just win at read time. This also self-heals older workspaces.

**2. Definition of "complete" for the ring**
- Treat an item as complete when `status ∈ {ready, scheduled, published, completed}` (i.e. it has generated content or is further along). `pending`/`generating`/`failed` don't count.
- This matches the user's expectation ("all seven have content" → 7/7 on the milestone in the screenshot).

## Out of scope
- Backfilling/removing the stored `completed_items` column.
- Adding a DB trigger — a read-time compute is enough and avoids schema churn. If we want a trigger later, that's a follow-up.

## Verification
- Reload `/workspaces/06fc9102-…` and confirm the ring shows `7/7`.
- Confirm the milestones list on `/workspaces` also shows correct `x/y` for other milestones (uses the same `listWorkspaces`).
- Typecheck.
