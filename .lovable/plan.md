## Goal

Make Milestone Prep / Workspaces reachable and visible from `/create`. Today it only lives at `/workspaces`, and the `/create` hub has no entry point or active-context indicator.

## Changes

### 1. `/create` hub header (`src/routes/_authenticated/create.index.tsx`)
- Mount `ActiveWorkspacePill` at the top. When a workspace context is set (Zustand store or `?wsId=` URL param), show the pill with milestone title, phase chip, and a "Clear" affordance.
- Add a compact **Milestones** row directly under the search bar:
  - Primary CTA: **"New Milestone"** → opens `MilestonePrepSheet` in-place (no navigation away from `/create`).
  - Secondary link: **"View all →"** → `/workspaces`.
  - Horizontal scroll strip of up to 5 active workspaces (via `useWorkspaces({ status: 'active' })`). Tapping one sets it as the active workspace context and stays on `/create`.

### 2. Format cards behavior when a workspace is active
- When `ActiveWorkspacePill` is set, tapping any `FormatCard` navigates to `/create/$formatId?wsId=…` (and `wsItemId` if the workspace has a pending item matching that format). This reuses the existing search-param contract already handled in `create.$formatId.tsx`.
- Add a subtle "Scoped to {milestone}" caption above the format grid when context is set.

### 3. Per-format page (`src/routes/_authenticated/create.$formatId.tsx`)
- `ActiveWorkspacePill` already renders here — add an **"Attach to milestone"** button next to it when no workspace context is present. Opens a small sheet listing active workspaces + "New milestone…" that reuses `MilestonePrepSheet`.
- When a draft is generated with a workspace context, show a toast with a link back to `/workspaces/$id`.

### 4. Sheet reuse
- Import and mount `MilestonePrepSheet` from `src/components/workspaces/MilestonePrepSheet.tsx` inside `/create` — no duplication. On completion, set the newly created workspace as active context via `workspaceContextStore` so the next format tap carries `wsId`.

### 5. Home CTA cleanup
- The home page already links to `/workspaces`; no change needed there. Ensure the `/create` "Milestones" row is discoverable enough that users don't need to leave the hub.

## Out of scope
- No changes to workspace data model, server functions, or `[WORKSPACE_CONTEXT]` injection — all wired already.
- No changes to `/workspaces` list/detail pages.
- No new theme/typography.

## Files touched
- `src/routes/_authenticated/create.index.tsx` (header pill, Milestones row, sheet mount, workspace-aware navigation)
- `src/routes/_authenticated/create.$formatId.tsx` ("Attach to milestone" affordance, post-generate toast)
- Possibly a small `src/components/create/MilestonesStrip.tsx` for the horizontal strip.

## Acceptance
- On `/create` with no context: see "New Milestone" CTA + strip of active workspaces.
- Tapping a strip item sets active context; pill appears; tapping a format opens `/create/$formatId?wsId=…`.
- "New Milestone" opens `MilestonePrepSheet` without leaving `/create`; completing it sets context and closes the sheet.
- On `/create/$formatId` with no context: "Attach to milestone" is visible; selecting one sets `wsId` in the URL and updates the pill.
