# Media Hub — plan

## Current state (verified)

- There is **no** media hub today. `rg` for "media hub / asset manager / media library" returns nothing.
- Existing media is **draft-scoped only**: the `create_media` table and the private `draft-media` storage bucket are attached to `create_drafts` (see `src/lib/drafts/drafts.functions.ts`, `ImageAssociationSheet.tsx`).
- There is no route, table, bucket, or nav entry for user-owned, draft-independent assets.

So yes — we need to build it.

## What we're building

A per-user **Media Hub** that stores images, documents, audio, video, and other files independent of any draft. It's the durable "digital asset manager" users can browse, upload to, tag, search, preview, download, delete, and reuse when creating content or associating an image with a draft.

## Scope (v1)

1. **New Settings entry**: Settings → Media Hub (also reachable as `/settings/media`), with a "Open Media Hub" pill on the Settings index row.
2. **Full page**: `/_authenticated/media` (grid + list toggle, filter by type/tag, search by name).
3. **Storage**: a new private bucket `media-hub` (per-user path `${userId}/…`), separate from `draft-media` so retention rules and quotas stay independent.
4. **Schema**: a new `media_assets` table (see technical section).
5. **Ingest**: drag-and-drop dropzone + file picker + paste. Reuses the DomainIngestZone visual pattern. Supports multi-file upload with progress.
6. **Asset detail sheet**: preview (image/pdf/audio/video), rename, tags, description, replace file, download, delete, "copy link", "use in a draft" (opens ImageAssociationSheet pre-filled).
7. **Draft integration**: `ImageAssociationSheet` and cover-image pickers get a new tab "From Media Hub" so uploaded assets are reusable across drafts without re-upload.
8. **Search/filter**: by filename, tag, mime type category (image / document / audio / video / other), date.
9. **Guards**: RLS scoped to `auth.uid()`, private bucket, signed URLs for preview/download.

Out of scope (v1): folders/nesting, sharing with other users, AI auto-tagging, versioning, quota UI (we'll log size but not enforce a hard cap yet).

## Workflow integration

- **Settings index** → new row "Media Hub · N items · X MB" with an inline chip, linking to `/settings/media` (which forwards to `/media` — keeps discoverability in Settings while the hub itself lives at a top-level authenticated route so it's fast to reach).
- **Create flow (image association / cover picker)** → new "Media Hub" tab next to "Upload" / "Generate". Selecting an asset writes its `create_media` row referencing the same storage object (or copies, TBD in tech section).
- **Domain ingest / Knowledge** → unchanged. Knowledge stays about *reference text*; Media Hub is about *binary assets*.
- **Drafts / Archive** → unchanged. A draft's inline media stays in `draft-media`; only assets explicitly saved to the hub live in `media-hub`.
- **Brain** → future: surface media as nodes. Not v1.

## Technical section

### Storage bucket

- `media-hub` (private). Path convention: `${userId}/${assetId}/${filename}`.
- RLS on `storage.objects`: user can CRUD only rows where `bucket_id = 'media-hub' AND (storage.foldername(name))[1] = auth.uid()::text`.

### Table `public.media_assets`

Columns (domain fields only):
- `user_id uuid` (→ auth.users)
- `filename text`, `mime_type text`, `size_bytes bigint`
- `storage_path text` (bucket path)
- `kind text` — enum-ish: `image | document | audio | video | other` (derived from mime, stored for cheap filtering)
- `title text` (defaults to filename), `description text nullable`
- `tags text[] default '{}'`
- `width int nullable`, `height int nullable`, `duration_seconds numeric nullable` (populated when known)
- `checksum text nullable` (sha256, for dedupe later)
- Standard `id`, `created_at`, `updated_at` + update trigger.

GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon`.
RLS: all four policies gated by `auth.uid() = user_id`.

### Server functions (`src/lib/media/media.functions.ts`)

- `listMediaAssets({ q?, kind?, tags?, limit, cursor })`
- `getMediaAsset({ id })` → returns row + short-lived signed URL
- `createMediaAsset({ filename, mime_type, size_bytes, storage_path, kind, width?, height?, duration_seconds?, checksum? })` — called after client-side upload finishes
- `updateMediaAsset({ id, title?, description?, tags? })`
- `deleteMediaAsset({ id })` — deletes row + storage object
- `signMediaUrl({ id, expiresIn })` — for previews/downloads

All `.middleware([requireSupabaseAuth])`.

### Client upload flow

1. User drops N files into the hub dropzone.
2. For each file, generate `assetId = crypto.randomUUID()`, upload directly to `media-hub/${userId}/${assetId}/${safeName}` via the browser Supabase client (RLS enforces ownership).
3. On upload success, extract width/height (images) or duration (audio/video via `HTMLMediaElement.duration`) in the browser, then call `createMediaAsset` server fn to persist metadata.
4. Show per-file progress + retry.

### Draft reuse

- Add a `mediaAssetId` column to `create_media` (nullable) so a draft image can point back to the hub asset it came from (avoids duplicate uploads).
- New tab in `ImageAssociationSheet`: "From Media Hub" — queries `listMediaAssets({ kind: 'image' })` and, on select, inserts a `create_media` row referencing the same `storage_path` and `mediaAssetId`.

### Routes

- `src/routes/_authenticated/media.tsx` — hub page (grid, filters, search, dropzone, empty state).
- `src/routes/_authenticated/settings.media.tsx` — thin Settings entry: quick stats + "Open Media Hub" button linking to `/media`.
- Update `src/routes/_authenticated/settings.index.tsx` to add the row.

### Components

- `src/components/media/MediaGrid.tsx`
- `src/components/media/MediaCard.tsx`
- `src/components/media/MediaDetailSheet.tsx`
- `src/components/media/MediaDropzone.tsx`
- `src/components/media/MediaFilters.tsx`
- Reuse existing `Pill`, `EveSheet`, `RecordingIndicator` styles for consistency.

### Migrations (single migration)

1. `CREATE TABLE public.media_assets (...)` + GRANTs + `ENABLE ROW LEVEL SECURITY` + owner CRUD policies.
2. Trigger `update_updated_at` on `media_assets`.
3. `ALTER TABLE public.create_media ADD COLUMN media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;`
4. Storage bucket `media-hub` created via `supabase--storage_create_bucket` (private) in the same turn; storage.objects RLS policies added via migration.

### Formatting rule compliance

Descriptions and tag chips render as formatted UI — no raw JSON / Markdown surfaces to the user (per global rule).

## Deliverables order

1. Migration (table + bucket policies + `create_media` FK).
2. Server functions + hook (`useMediaAssets`).
3. `/media` page with dropzone, grid, filters, detail sheet.
4. Settings entry + index pill.
5. `ImageAssociationSheet` "From Media Hub" tab.
6. Smoke test: upload 3 mixed files, rename, tag, delete, reuse in a draft.
