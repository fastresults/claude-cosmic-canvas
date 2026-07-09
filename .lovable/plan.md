# Written Voice System — Implementation Plan

Rebuilds the thin `voice_profiles` surface into a full portable Voice system that every AI generation resolves through, tunes, and learns from. Follows the PRD; adapts to this codebase (existing `personas` act as the scope). Adds two explicit invariants: **every generation is gated by the user's currently selected voice**, and **every voice is a first-class node in the Second Brain**.

## 1. Data model (single migration)

New/changed tables in `public` (each with GRANTs + RLS + owner policies):

- `voice_profiles` — extend existing row: `name`, `category`, `tone`, `guidelines` (md), `vocabulary_preferred text[]`, `vocabulary_avoid text[]`, `formality/humor/technicality/conciseness int` (0-100, default 50), `is_default bool`, `source` (scratch|persona|analyze|research|url|template|import|system). Keep `samples jsonb`, `persona_id` (nullable = personal-scope), `user_id`. Partial unique index enforces one `is_default=true` per `(user_id, persona_id)` scope.
- `system_voices` — global catalog: name, profession, tagline, category, tone, guidelines, samples, vocab, sliders, is_visible, sort_order. Public `SELECT TO anon,authenticated`; writes restricted via `has_role('admin')`.
- `voice_signals` — append-only ledger: `signal_type` (edit|approval|rejection|regeneration), `original_text`, `edited_text?`, `context jsonb`, `voice_profile_id`, `processed_at?`. Owner insert+select only.
- `voice_directives` — `directive_type`, `directive_text`, `evidence_count`, `status` (suggested|active|dismissed), unique `(voice_profile_id, directive_type, lower(directive_text))`.
- `voice_learning_settings` — `user_id pk`, `auto_promote_threshold int default 3`, `enabled bool default true`.
- **`profiles.active_voice_id uuid`** — the user's currently selected voice, used by the gate (per-persona override lives in `personas.active_voice_id` for future multi-persona work).

### Second Brain integration (invariant)
Every VoiceProfile becomes a Brain node in the same transaction as its create/adopt/import:
- Insert row into `entities` (`kind='voice'`, `title=name`, `ref_id=voice_profile.id`).
- Insert `brain_edges` linking the voice entity to:
  - its `persona_id` (if scoped),
  - each `knowledge_entries.id` referenced by its samples (when a sample came from Knowledge),
  - the SystemVoice it was adopted from (edge `kind='adopted_from'`).
- Rename/delete/duplicate propagates to `entities` + `brain_edges` (cascade FK on `ref_id`). Result: Brain canvas shows voices as first-class nodes, connectable to knowledge, personas, and drafts.

## 2. Server functions (`src/lib/voice/*.functions.ts`)

Typed RPC via `createServerFn` + `requireSupabaseAuth`. AI via existing `ai/gateway.server.ts` with structured `Output.object` schemas — no `.min/.max` on schemas, limits enforced in prompt + code, `NoObjectGeneratedError.isInstance` fallback returning `{fallback:true}`.

CRUD + selection:
- `listVoiceProfiles({personaId?})`, `getVoiceProfile`, `createVoiceProfile`, `updateVoiceProfile`, `deleteVoiceProfile`, `duplicateVoiceProfile`, `exportVoiceProfile`, `importVoiceProfile` (Zod-validated).
- `setDefaultVoiceProfile({id, personaId?})` — single SQL statement enforces one default per scope.
- **`setActiveVoice({id})`** — writes `profiles.active_voice_id`; emits `voice.activated` audit event.
- **`getActiveVoice()`** — returns the currently selected profile (used by the gate + composer badge).
- `listSystemVoices`, `adoptSystemVoice({id, name})` — clones into `voice_profiles` and creates Brain node in one transaction.
- `listDirectives`, `updateDirective`, `deleteDirective`, `getLearningSettings`, `updateLearningSettings`.

AI pipelines:
1. `analyzeOwnVoice({samples[]})` → draft VoiceProfile.
2. `researchVoiceProfile({name, focus?, depth})` — `quick` = gemini-3.5-flash, `deep` = gpt-5.5.
3. `enrichVoiceProfile({partial})` — fills missing fields only.
4. `generateVoiceSamples({voiceProfileId})` → 3 samples matching current sliders/guidelines.
5. `captureVoiceSignal(...)` — always 200; inline-distills when unprocessed backlog ≥ 5.
6. `distillVoiceDirectives({voiceProfileId})` — reads ≤25 signals, upserts 1–5 directives, auto-promotes at threshold, marks signals processed.
7. `validateVoice({text, voiceProfileId})` → `{score, issues[], suggestions[]}`.
8. `batchGenerateSystemVoices` — admin-only.

### The Generation Gate (invariant)
Every AI generation server fn in the app (existing `orchestrate.functions.ts` and any future draft/rewrite/composer fn) MUST go through:
```
resolveActiveVoice({overrideId?}) → voice_profile
  → formatStyleContext(profile, {learnedPreferencesBlock})
  → prepended as system prompt
```
- `resolveActiveVoice` order: explicit override → persona-scope default → `profiles.active_voice_id` → user default → first profile.
- If the user has zero voices: server fn returns `{ needsVoice: true }` (never 500). Client shows a mandatory "Pick or create a voice" sheet before the generation proceeds.
- Every generation logs `generation.used_voice(id, had_directives)` to `audit_log`.
- `formatStyleContext` lives in `src/lib/voice/format-style-context.server.ts` and is the single integration point — enforced by updating `orchestrate.functions.ts` in this same PR.

## 3. Signal capture wiring

`src/lib/voice/capture-signal.ts` (client helper) wraps the server fn as fire-and-forget. Wired into draft edits (DraftCard save, working-draft edits) and regenerate/approve/reject actions in Library and composer — the only touches outside Settings → Voice.

## 4. UI — mobile-first Voice & Style workspace

Rewrites `src/routes/_authenticated/settings.voice.tsx` and adds sub-routes. Single-column, sticky Save, ≤2-tap access. New components under `src/components/voice/`.

Routes:
- `/settings/voice` — profile list: default badge, **active badge (from `profiles.active_voice_id`)**, category chips, per-persona grouping, search, "New voice" FAB opening an AI-first empty-state sheet (Analyze / Research / Persona library / From scratch / Template).
- `/settings/voice/$id` — single-column editor: name, tone, 4 sliders (haptic tick, Tone Preview on release via `generateVoiceSamples`), guidelines textarea, preferred/avoid chips (case-insensitive dedupe, mutually exclusive), samples list with hold-to-record (reuses `HoldToSpeakButton` + existing `aiTranscribe`), "Generate more samples", "Voice DNA" one-pager, "Set active" button.
- `/settings/voice/$id/learned` — swipeable directive cards (swipe-right approve, swipe-left dismiss), active-rules list, enable toggle + threshold slider.
- `/settings/voice/library` — SystemVoices catalog with search/category/preview/adopt.
- `/settings/voice/research` — name + focus + depth, cancellable server-side progress with phase label, section-picker save.
- `/settings/voice/import` — JSON paste/upload.

Global surfaces (gate visibility):
- **`VoiceSwitcher` popover** on `ComposerBar`, always visible next to the send/generate action. Shows: current active voice, one-tap switch, "set as default", "one-shot override for this draft". Reads/writes `profiles.active_voice_id` via `setActiveVoice`.
- **Active-voice badge** rendered in `TopBar` and beside every AI action so the user always knows which voice is applied.
- **Zero-voice guard:** any generation surface with no active voice renders a blocking sheet — no bypass, no "default to system voice" fallback. The gate is the user's choice.

Brain canvas:
- `BrainCanvas` renders voice entities as a new node kind (`kind='voice'`), styled distinctly, connected to persona/knowledge/adopted-from nodes. Tapping a voice node deep-links to `/settings/voice/$id`.

## 5. Rules enforcement

- Slider clamp 0–100 (Zod + default 50).
- Vocabulary util: trim, lowercase-compare dedupe, mutual exclusion (last write wins + warning).
- Sample cap 5 × 2,000 chars, markdown stripped on save.
- Directive injection: `status='active'` only, sorted `evidence_count desc`, cap 50.
- Deletes: confirm dialog; cascade to `voice_signals`, `voice_directives`, `entities`, `brain_edges` for that profile. If deleted voice was `active_voice_id`, clear it and prompt user to pick another.
- `setDefaultVoiceProfile` in one SQL: `UPDATE voice_profiles SET is_default = (id = $1) WHERE user_id = $2 AND persona_id IS NOT DISTINCT FROM $3`.

## 6. Telemetry

Reuse `audit_log`: `voice.created(source)`, `voice.updated(field)`, `voice.set_default`, `voice.activated`, `voice.deleted`, `voice.adopted_from_persona`, `voice.research_started/completed`, `voice.analyze_started/completed`, `signal.captured(type)`, `directive.suggested/promoted/approved/dismissed`, `generation.used_voice(id, had_directives)`, `generation.blocked_no_voice`.

## 7. Acceptance targets (PRD §11 + this app's invariants)

- New user creates first voice in ≤60s on mobile via Analyze.
- ≥5 profiles, VoiceSwitcher reachable in ≤2 taps from composer.
- After 3 edits, distill auto-promotes ≥1 directive with no user action.
- `validateVoice` score improves when active directives are present.
- Default invariant holds under concurrent edits.
- **Every generation call resolves through `resolveActiveVoice`; with no voice selected the UI blocks and prompts — no silent fallback.**
- **Every voice appears as a node in the Brain canvas, connected to its persona and any linked knowledge.**
- All AI pipelines degrade with `{fallback:true}` and toast, never crash the UI.

## 8. Out of scope this pass

- True multi-tenant client accounts (personas cover the scope for now).
- Audio/TTS voice cloning, billing, non-English tuning.

## Technical notes

- One migration file: enums, tables, GRANTs, RLS, policies, cascade FKs, partial unique index on `is_default`, `profiles.active_voice_id` column.
- Zod schemas in `src/lib/voice/schemas.ts` (client-safe), reused by validators and import/export.
- AI schemas remain permissive; limits in prompt + post-parse clamp.
- No changes to `client.ts`, `types.ts` (regenerated), or Supabase-managed schemas.
- `orchestrate.functions.ts` updated to route through the gate in this PR; other generation surfaces (future) inherit the pattern by using `resolveActiveVoice` + `formatStyleContext`.
