## Context reality check

The v2 PRD assumes a legacy sprawl of 15+ per-format draft tables unioned in the browser. **This app doesn't have that.** Every Create format already writes to a single `create_drafts` table with `archived`, `status`, `workspace_id`, `quality_score`, `sections`, plus `create_version_history` and `create_media` polymorphic siblings. Workspace exclusion is already a server contract in `listCreateDrafts`.

The "unify 15 tables" work is already done. Real gaps: Drafts hub UI, Archive page, **per-draft image generate → preview → attach flow**, detail sheet with interactive context pills, scheduling, Brain wiring for draft images, voice-orb intents.

## Deliverable

Mobile-first Drafts hub wired into Create → Workspaces → Voice → Knowledge → Presets → Brain. Behavior/data only; no theme changes.

## Scope

### 1) Data model (additive)

`create_drafts`: add `platform`, `scheduled_at`, `published_at`, `campaign_id`, `virality_score`, `authenticity_score`, and any missing FKs (`preset_id`, `voice_id`, `knowledge_profile_id`, `client_profile_id`).

`create_media` (audit first, add what's missing): `role text check (role in ('cover','social','inline'))`, `parent_image_id uuid` (edit lineage), `generated_by text` ('gpt-image-2'|'gemini'|'upload'|'library'), `aspect_ratio text`, `prompt text`, `style_id text`, `sort_order int`. **Every image row is scoped to a single `draft_id` — this is the association.**

`scheduled_content` if missing: `draft_id`, `platform`, `scheduled_at`, `status`, `error`.

Migrations follow CREATE → GRANT → RLS → POLICY; `auth.uid() = user_id`.

### 2) Server functions (`src/lib/drafts/drafts.functions.ts`)

- `listDrafts`, `getDraft`, `archiveDraft`, `restoreDraft`, `duplicateDraft`, `moveDraftToCampaign`, `moveDraftToWorkspace`, `scheduleDraft`.
- `regenerateDraft` / `polishDraft` — extend existing preset injection with `[DRAFT_HISTORY]`; writes new `create_version_history` row + Brain `REGENERATED_FROM` edge.
- **Image path (per draft):**
  - `generateImageConcepts({ draftId })` — grounded via `[DOMAIN]→[VOICE]→[KNOWLEDGE]→[PRESET]→[WORKSPACE_CONTEXT]→[DRAFT_SUMMARY]`; returns 3–6 concepts (prompt · style · aspect · one-line rationale) using Lovable AI Gateway chat model.
  - `attachDraftImage({ draftId, role, url, prompt?, styleId?, parentImageId?, generatedBy })` — inserts `create_media` row **linked to `draft_id`** and writes Brain edges (`draft →REFERENCES→ image`, `image →GENERATED_BY_TOOL`, `image →REGENERATED_FROM parent_image_id` when reroll).
  - `listDraftImages({ draftId })` — reads current images for a draft, grouped by role.
  - `removeDraftImage({ id })`.

Image streaming (`google/gemini-3-pro-image`, `stream: true`, blur partials → sharpen final): **server route** `src/routes/api/drafts/generate-image.ts` — pass upstream body through untouched (per the streaming contract in the image-gen knowledge). Client uses shared `streamImage` helper with `flushSync` and `eventsource-parser`.

### 3) Client surface (mobile-first)

Routes:
- `/content/drafts` — `DraftsHubPage`: sticky one-row filter bar (Format · Status · Archive · More…), `useInfiniteQuery` on `listDrafts`, scroll memory, drafts-remaining badge.
- `/content/drafts/$id` — opens `DraftDetailSheet` (full-screen bottom sheet via existing `EveSheet`).
- `/content/archive` — same shell, archived scope, Archive↔Restore swap.

Components (`src/components/drafts/`):
- `DraftCard` — title, snippet, platform badge, **image thumbnail carousel from `create_media`**, quality chip, quick actions (Open · Polish · **Image** · Schedule · Archive). Long-press → action sheet.
- `DraftDetailSheet` — preview, version scrubber, **image tray grouped by role (cover/social/inline)** with "+ Add" per role opening `ImageAssociationSheet` pre-scoped to that draft and role, interactive context pills (`ActiveVoiceBadge`, `ActivePresetPill`, Knowledge pill, `ActiveWorkspacePill`) that mutate the draft and re-hydrate injection for the next regen, action dock in thumb zone.
- **`ImageAssociationSheet` (the per-draft image flow)** — takes `{ draftId, role }`. Three tabs:
  - **Generate** (default): calls `generateImageConcepts(draftId)` → renders concept chips → tap → POST `/api/drafts/generate-image` with the concept prompt → SSE stream renders partial PNGs blurred, final unblurred → **Preview → Confirm** → `attachDraftImage(draftId, role, …)`. Reroll and edit reuse `parent_image_id` for lineage. **Nothing writes to the draft until Confirm.**
  - **Upload**: dropzone + mobile camera → optional crop → `attachDraftImage(generatedBy:'upload')`.
  - **Library**: picker over existing `create_media` for this user → attach existing image (creates a new row scoped to this draft, `generatedBy:'library'`).
- `SchedulePicker` — bottom sheet writing `scheduled_content`.

Hooks: `useDrafts`, `useDraft`, `useDraftMutations`, `useDraftImages(draftId)`, `useDraftImageStream`.

### 4) How the per-draft image association is guaranteed

- `create_media` rows carry `draft_id NOT NULL` — an image without a draft cannot exist.
- Every attach call goes through `attachDraftImage({ draftId, role, … })` — no client-side inserts.
- `DraftDetailSheet` opens `ImageAssociationSheet` with the current `draftId` and target `role` already bound; the sheet has no free-floating "generate" that isn't tied to a draft.
- The Create flow also gets a "Generate cover image" quick action on the post-generation toast that opens the same sheet with the just-created `draftId`.
- Brain edges tie image → draft → workspace/campaign/preset/voice so Universal Search can find images by their parent draft's context.

### 5) Integrations with existing systems

- **Create hub**: post-generation toast → "View in Drafts" + "Add cover image" (opens `ImageAssociationSheet` for the new draftId, role=cover). Recent drafts strip on `/create` via existing `useRecentCreateDrafts`.
- **Workspaces**: workspace-scoped drafts stay hidden from `/content/drafts` by contract; "Move to workspace" is first-class.
- **Voice / Knowledge / Presets**: context pills write back to draft row so next regen rehydrates full injection.
- **Brain**: every archive/restore/attach/schedule/publish emits an edge via `writeEdgeServer`.
- **Voice orb**: add intents `drafts.list|polish|image_concepts|schedule|archive|restore|search|move_to_campaign|move_to_workspace`; each opens the right sheet without leaving the current screen.

### 6) AI-first defaults

- Draft list ranked server-side by quality × recency × workspace priority; user can flip to "Most recent".
- Each draft opens with a "Suggested next step" chip (Polish · Fit-to-Limit · **Add cover image** when no `role='cover'` media exists · Schedule).
- Image concepts always grounded — never a raw prompt box as the default entry.

### 7) Out of scope

- No theme/typography changes.
- No legacy-table migration (they don't exist here).
- No video generation this pass.
- No new social connectors.

## Technical notes

- Streaming image route lives at `src/routes/api/drafts/generate-image.ts`; every other backend call is `createServerFn` with `requireSupabaseAuth`.
- No client-side table unions — everything reads `listDrafts` / `listDraftImages`.
- Reuse `EveSheet`, `DraftCard` primitive, `ActiveWorkspacePill`, `ActivePresetPill`, `ActiveVoiceBadge`.
- Extend `src/lib/presets/injection.ts` with `DRAFT_HISTORY` and `DRAFT_SUMMARY` slots (used by regen and image concepts respectively).

## Files to add/edit

New: `supabase/migrations/<ts>_drafts_hub.sql`, `src/lib/drafts/drafts.functions.ts`, `src/routes/api/drafts/generate-image.ts`, `src/routes/_authenticated/content.drafts.index.tsx`, `src/routes/_authenticated/content.drafts.$id.tsx`, `src/routes/_authenticated/content.archive.tsx`, `src/components/drafts/*` (DraftCard, DraftDetailSheet, ImageAssociationSheet, SchedulePicker), `src/hooks/useDrafts.ts`, `src/hooks/useDraftImages.ts`, `src/lib/drafts/streamImage.ts`.

Edit: `src/lib/presets/injection.ts`, `src/routes/_authenticated/create.index.tsx` (recent drafts strip, post-gen toast), `src/routes/_authenticated/create.$formatId.tsx` (link into ImageAssociationSheet after save), `src/components/shell/BottomNav.tsx` (Drafts entry), voice orb intent catalog.

## Acceptance

- `listDrafts` returns filtered drafts + facet counts < 400ms for 1k rows.
- Workspace-scoped drafts absent from `/content/drafts`.
- Archive preserves media + Brain edges; item remains searchable.
- Regen/polish writes new `create_version_history` + Brain edge.
- Context pills demonstrably alter the next injection stack (verified in edge logs).
- **Per draft, a user can: open detail sheet → tap "+ Add" on cover/social/inline role → generate grounded concepts → stream preview (blurred partials → sharp final) → Confirm → image row exists in `create_media` with `draft_id`, `role`, `prompt`, `generated_by`, and Brain edges. Round-trip median < 20s.**
- Upload and Library tabs write the same `create_media` shape with correct `generated_by`.
- Reroll preserves `parent_image_id` lineage.
- Scroll memory preserved across navigation.

## Next step after approval

Build mode → migration first (await approval) → server functions + streaming image route → hub/detail/archive pages → `ImageAssociationSheet` → Create integration + orb intents.