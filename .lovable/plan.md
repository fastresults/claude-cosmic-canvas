# Fix: Style templates don't load in Generate Image sheet

## Diagnosis (from logs)

- User tapped a `social` slot on a draft card → `ImageAssociationSheet` opened on the **Generate** tab.
- `generateImageConcepts` server fn returned 200 with 4 concepts (network log confirms).
- What actually "didn't load" isn't concepts — it's the **style-templates grid** the PRD (`docs/prd/draft-image-generation-lovable-prompt.md`) specifies as the primary picker above concepts. That UI and its backing table were never built in this app. Only the concept cards render today, so the user sees no style thumbnails and reads it as "templates failed to load."

Fix: implement the missing style-template layer end-to-end (data → server fn → hook → UI) and wire it into the Generate tab, filtered by the current slot role.

## Plan

### 1. DB migration — `image_generation_styles`

Create the table per the PRD (already spec'd there), seed ~15 rows, add RLS + GRANTs. Non-negotiable order: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → policies.

Columns: `style_id text pk`, `name`, `description`, `preview_url` (thumbnail), `prompt_prefix` (injected into image prompt), `negative_prompt`, `supported_types text[]` (subset of `cover|social|inline`), `display_order int`, `is_enabled bool default true`, `created_at`.

Policies:
- `SELECT` to `anon, authenticated` where `is_enabled = true`.
- `ALL` to admins via `has_role(auth.uid(),'admin')`.

Seed rows across Photography, Editorial, Illustration, 3D, Infographic; each row's `supported_types` picks the roles it makes sense for (e.g. `social` styles = square-friendly, bold).

### 2. Server fn — `listImageStyles`

New export in `src/lib/drafts/drafts.functions.ts`:

- Input: `{ role: "cover"|"social"|"inline" }`.
- Query `image_generation_styles` where `is_enabled = true` AND `role = ANY(supported_types)`, ordered by `display_order`.
- Returns `Array<{ styleId, name, previewUrl, promptPrefix, negativePrompt }>`.
- Public read (no auth middleware needed since RLS allows anon SELECT on enabled rows), or use `requireSupabaseAuth` for consistency — pick auth middleware to match sibling fns.

### 3. Hook — `useImageStyles(role)`

Add to `src/hooks/useDraftImages.ts`. `useQuery` keyed by `["image-styles", role]`, calls the new server fn, `staleTime: 5 * 60_000` (styles rarely change).

### 4. UI — style grid in `ImageAssociationSheet` Generate tab

In `src/components/drafts/ImageAssociationSheet.tsx` `GenerateTab`:

- Above the concept list, render a **Style templates** section:
  - Loading skeleton while `useImageStyles` is pending (currently no visual feedback = "didn't load").
  - Empty state: "No styles available for this slot yet." with a subtle admin hint if `has_role` admin.
  - Error state with retry (invalidate query).
  - Grid: 2-col horizontal-scroll strip on mobile (`<640px`), 3–4 col grid on larger. Each card shows `previewUrl` thumb + `name`. Selecting a style highlights it and passes `promptPrefix` + `negativePrompt` to `run()`.
- When user picks a concept, the currently-selected style's `promptPrefix` gets prepended and `negativePrompt` passed through to the `/api/drafts/generate-image` request. If no style selected, generate as today (unchanged behavior).
- Persist `selectedStyleId` in local component state; default to first style once loaded.

### 5. Wire style into generate + attach

- Extend `streamDraftImage(prompt, cb, aspect, negativePrompt?)` signature to accept an optional negative prompt and forward it to `/api/drafts/generate-image`.
- Update `src/routes/api/drafts/generate-image.ts` to accept `negativePrompt` and include it in the upstream body (append to the user content — Gemini image API takes a single message).
- On attach (`useAttachDraftImage`), pass `styleId: selectedStyleId` so `create_media.style_id` is populated (column already exists per code).

### 6. Acceptance

- Open a draft → tap `+` on Social slot → sheet opens on Generate.
- Style strip shows N thumbnails filtered to `supported_types` containing `social`, ordered by `display_order`.
- Skeleton visible during load, error state shows retry, empty state readable.
- Selecting a style highlights it; picking a concept generates with the style's prompt prefix + negative applied.
- `create_media` row on attach carries the chosen `style_id`.
- Cover and Inline slots each show their own filtered subset.

## Out of scope

- Admin CRUD UI for styles (SQL seed is enough).
- Illustration / Infographic fast-path buttons from the PRD.
- Crop / text-overlay states.
