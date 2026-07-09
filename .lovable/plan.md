# Voice Personas Catalog — PRD + Seeded Library

Two deliverables in one turn: (1) a self-contained PRD doc another app can ingest, and (2) the 54 personas actually seeded into `system_voices` so the current app's picker shows the full curated library (not just "Untitled voice").

## 1. `docs/prd/voice-personas-catalog.md`

Sections, in order:

1. **Overview** — what a "voice" is, and the promise that any app implementing this schema will produce comparable output.
2. **Part 1 — Voice Schema (12 fields + meta)** — table verbatim from the request: `name`, `profession`, `tagline`, `category` (enum of 10), `tone`, `guidelines`, `formality`, `humor`, `technicality`, `conciseness`, `preferred_terms[]`, `avoid_terms[]`, plus `writing_samples[]`, `is_visible`, `sort_order`, `created_by`.
3. **Slider semantics (0–100)** — canonical anchors for Formality / Humor / Technicality / Conciseness at 0, 50, 100.
4. **Category taxonomy** — 10 IDs, labels, one-line descriptions, mirrored from the app's category list (public_figures, business_leaders, consulting_strategy, marketing_sales, thought_leadership, academic_journalism, journalism, coaching_self_help, investment_finance, spirituality, other).
5. **Composition contract** — exact ordering Tone → Guidelines → Vocabulary (prefer/avoid) → Samples → optional `LEARNED PREFERENCES` (active directives, top 50 by evidence). Includes reference `formatStyleContext(profile, {activeDirectives})` pseudocode block matching `src/lib/voice/format-style-context.server.ts`.
6. **Part 2 — Full catalog (54 rows)** — grouped tables per category exactly as supplied (Public Figures 4, Business Leaders 2, Consulting 4, Marketing 7, Thought Leadership 4, Academic/Journalism 8, Journalism 5, Coaching/Self-Help 9, Investment 1, Spirituality 10), each row: Name · Profession · Tagline · F/H/T/C.
7. **Deduplication note** — flags Simon Sinek, Brené Brown, Mel Robbins, Oprah, Billy Graham, Timothy Keller, Charles Spurgeon, Priscilla Shirer, N.T. Wright duplicates; recommends which to keep; marks cleanup as follow-up, not executed.
8. **Full-fidelity export note** — `tone`, `guidelines`, `preferred_terms`, `avoid_terms`, `writing_samples` are large; implementers should pull them from `system_voices` via a one-time export rather than inlining (>200 KB).
9. **Companion JSON** — `docs/prd/voice-personas-catalog.json` generated alongside, 54 objects with all 12 schema fields (long-text fields included) — ready to seed another database.

## 2. Seed `system_voices` (migration)

Currently the voices list only shows the user's "Untitled voice". Seed the 54 personas as `system_voices` rows so the picker/library reflects the catalog, and users can adopt one into their `voice_profiles` via the existing `adoptSystemVoice` flow.

Migration will:

- Insert 54 rows into `public.system_voices` (`is_visible=true`, per-category `sort_order`, `created_by=null` system-owned).
- Each row includes: name, profession, tagline, category, tone, guidelines (1–2 paragraph markdown), 4 sliders, preferred_terms (5–10), avoid_terms (5–10), 2 writing_samples.
- Idempotent: `ON CONFLICT (name) DO NOTHING` (or add a unique index on name first if missing).
- No schema changes — `system_voices` already exists from prior migration.
- No RLS changes — table is already world-readable via existing grants.

## 3. UI wiring (verify only, no new components)

Confirm `/settings/voice` list surfaces `system_voices` alongside user voices with an "Adopt" action calling existing `adoptSystemVoice` server fn. If the existing route only lists `voice_profiles`, add a "Browse library" section that reads `system_voices` and adopts on tap → creates a `voice_profiles` row + Brain node, then navigates to the editor. Scope: additive rendering in `src/routes/_authenticated/settings.voice.tsx` only.

## Out of scope

- Dedup cleanup (called out in PRD, not executed).
- Editing existing voice logic, orchestrator, or directives pipeline.
- Regenerating any tone/guidelines text with AI — seed uses the curated values from the catalog.

## Technical notes

- Files created: `docs/prd/voice-personas-catalog.md`, `docs/prd/voice-personas-catalog.json`, one Supabase migration seeding 54 rows.
- File touched: `src/routes/_authenticated/settings.voice.tsx` (only if system voices aren't already listed).
- No secrets, no new dependencies, no edge functions.
