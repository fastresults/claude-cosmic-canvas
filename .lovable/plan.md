## Goal
Make the "Recent drafts" cards on `/create` visually distinguishable by content type (format), so users can scan them at a glance.

## Approach
Tint each recent-draft card's background (and left border accent) based on its `format_id`'s category (from `CREATE_FORMATS` / `CATEGORY_LABELS`). Categories already exist: e.g. `long_form`, `social`, `video`, `audio`, `visual`, etc.

## Changes

**1. `src/lib/create/format-colors.ts` (new)**
- Export `getCategoryTint(category)` returning `{ bg, border, chip }` class strings using existing semantic tokens (accent/primary/muted variants with low-alpha tints — no hardcoded colors).
- Also export `getFormatTint(formatId)` helper that resolves format → category → tint.
- Palette (all via tokens with `/10`, `/15`, `/40` opacities):
  - long_form → accent tint
  - social → primary tint  
  - video → destructive tint (muted)
  - audio → secondary tint
  - visual → chart-1 tint (or new token)
  - other → surface (current default)

**2. `src/styles.css`**
- Add 1–2 semantic tokens if needed (`--tint-video`, `--tint-visual`) as oklch values that work in both themes, so we don't reach outside the token system.

**3. `src/routes/_authenticated/create.index.tsx`**
- In the "Recent drafts" map, replace the static `bg-surface border-border` classes on each card with `getFormatTint(d.format_id)` output.
- Keep layout, sizing, and typography unchanged.
- Add a tiny colored dot before the format label (uses same tint's `chip` color) so the distinction is reinforced even when tint is subtle.

## Out of scope
- FormatCard grid tiles below (user asked about recent drafts specifically).
- DraftCard used elsewhere (Library/Drafts list) — can be a follow-up if desired.
- Dark/light contrast tuning beyond token-based opacities.

## Verification
- Typecheck.
- Visually confirm on `/create` that 2+ recent drafts of different formats show different card backgrounds while remaining readable in dark theme.
