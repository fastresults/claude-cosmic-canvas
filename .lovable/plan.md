# Surface the 54 seeded voices on the Voice & Style page

## Where they are now
- **Data**: 54 rows in `public.system_voices` across 10 categories (verified: `SELECT count(*) → 54`). Readable by any signed-in user via the existing `system_voices public read` RLS policy.
- **Server fn**: `listSystemVoices` in `src/lib/voice/voice.functions.ts` already returns them; `adoptSystemVoice` copies one into the user's `voice_profiles` and creates a Brain node.
- **UI (today)**: hidden inside the "+ New" bottom sheet, under a "Persona library" tab (`NewVoiceSheet` in `src/routes/_authenticated/settings.voice.tsx`, lines 274–391). This is why the screenshot only shows "Untitled voice".

## What to change

Add a **Persona library** section directly on `/settings/voice`, below the user's voices list, so all 54 are visible without opening a modal.

### `src/routes/_authenticated/settings.voice.tsx` (only file touched)

1. Query `listSystemVoices` at page level with `useQuery(["system-voices"])`.
2. Render a new section `<PersonaLibrary />` below the user's voices list:
   - Header row: "Persona library · 54 curated voices" + search input (filters by name/tagline/profession client-side).
   - Category chip filter row (horizontal scroll on mobile): All · Public Figures · Business Leaders · Consulting · Marketing · Thought Leadership · Academic & Journalism · Journalism · Coaching & Self-Help · Investment · Spirituality. Uses category IDs already on rows.
   - Grouped list by category; each row shows name, profession, tagline, F/H/T/C sliders as small pill, and an **Adopt** button that calls `adoptSystemVoice` → invalidates `voice-profiles` → navigates to `/settings/voice/$id`.
   - Empty state if a filter yields zero rows.
3. Keep the existing `NewVoiceSheet` "Persona library" tab as a shortcut, but the main page becomes the primary browsing surface.
4. Mobile-first: single-column, tap targets ≥44px, sticky category chips scroll horizontally.

### Note about the preview
The orange "Preview is showing an earlier version" banner in the screenshot means the current preview build predates the seed migration + library tab. After this change lands and the preview rebuilds, the 54 voices will render on the page directly.

## Out of scope
- No schema changes, no new server fns, no changes to `voice.functions.ts`.
- No dedup (called out in the PRD as follow-up).
- No changes to the composer, orchestrator, editor, or `ActiveVoiceBadge`.

## Technical notes
- File touched: `src/routes/_authenticated/settings.voice.tsx`.
- Category label map mirrors `docs/prd/voice-personas-catalog.md` §3.
- Uses existing `Pill` primitive and lucide icons already imported.
