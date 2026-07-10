# Seed style-template preview thumbnails

## Goal

Give each of the 15 rows in `image_generation_styles` a `preview_url` pointing to a representative thumbnail that visibly conveys the style. Users pick a template and see exactly what aesthetic they're opting into.

## Approach

Generate one on-brand thumbnail per style with the agent-side `imagegen` tool, host each via Lovable CDN assets (stable URLs, global cache, out of the git repo), then `UPDATE` the `preview_url` column per row.

Neutral subject across all 15 so the *style* is the variable — proposed subject: **an abstract mountain-and-sun composition** (works for photo, editorial, illustration, 3D, infographic without leaning any direction).

Square 1024×1024 thumbs (the strip renders 112×80, so 1024 is more than enough and covers retina). `fast` tier for cost — quality plenty at thumbnail size.

## Steps

### 1. Generate 15 thumbnails

For each style row, call `imagegen--generate_image` with `{promptPrefix} an abstract mountain-and-sun composition, thumbnail composition, no text, no watermark`, `1024x1024`, tier `fast`, target `src/assets/style-thumbs/{style_id}.jpg`.

Batch in parallel across all 15.

### 2. Upload each to Lovable CDN

```bash
lovable-assets create --file src/assets/style-thumbs/{style_id}.jpg > src/assets/style-thumbs/{style_id}.jpg.asset.json
rm src/assets/style-thumbs/{style_id}.jpg
```

Result: 15 `.asset.json` pointer files. Extract each `url` field (form `/__l5e/assets-v1/{asset_id}/{style_id}.jpg`).

### 3. Update rows via `supabase--insert`

Single `UPDATE ... FROM (VALUES ...)` statement mapping `style_id → url` for all 15 rows.

### 4. Verify

- Reload `/library`, open a draft → Social slot → Generate tab.
- Confirm the style strip shows real thumbnails (no more label-on-plain-tile).
- Selected style highlights with an accent border and thumb is legible.
- Repeat for a Cover slot — verify the different subset of styles renders their own thumbs.

## Notes

- CDN URLs are immutable, so a later re-shoot means new asset IDs + a second UPDATE (fine — no cache-busting needed).
- Storing on Lovable CDN (not the `draft-media` Supabase bucket) keeps these public, cache-friendly, and unrelated to per-user RLS.
- `preview_url` column already exists; no migration required.
- The `usePresets`-style component tile in `ImageAssociationSheet` already renders `background-image: url(previewUrl)` when set — no UI change needed.

## Out of scope

- Regenerating thumbnails per-user, per-brand, or with brand color overrides.
- Auto-refresh cron. Static seed is enough for now.
