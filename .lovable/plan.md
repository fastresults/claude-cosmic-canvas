# Written Voice System — Implementation Plan

Re-issuing the previously drafted plan so it renders in the UI. Nothing has been built yet; approving this plan switches to build mode and I'll execute it end-to-end.

## Goal

Rebuild the voice system per the PRD: portable, AI-first, mobile-first. Every AI generation is gated by the user's currently selected voice, and every voice is a first-class node in the Second Brain.

## 1. Data model (single migration)

Extend `voice_profiles`:
- `category text`, `tone text`, `guidelines text`
- `vocabulary_preferred text[]`, `vocabulary_avoid text[]`
- `formality`, `humor`, `technicality`, `conciseness` (int 0–100, default 50)
- `is_default bool`, `source text` (`scratch|analyze|research|library|import`)
- Partial unique index: one `is_default=true` per `(user_id, persona_id)`

New tables (each with GRANTs + RLS):
- `system_voices` — global catalog (read-only to `authenticated`)
- `voice_signals` — append-only ledger (`signal_type`, `original_text`, `edited_text`, `voice_profile_id`, `context jsonb`)
- `voice_directives` — distilled rules (`directive_type`, `directive_text`, `evidence_count`, `status`)
- `voice_learning_settings` — per-user learning toggles

Add `profiles.active_voice_id uuid` (nullable FK).

## 2. Server infrastructure (`src/lib/voice/`)

- `voice.functions.ts` — CRUD + `getActiveVoice`, `setActiveVoice`, `setDefaultVoiceProfile`, `duplicateVoiceProfile`, `adoptSystemVoice`, `listSystemVoices`, `resolveActiveVoice`
- 8 AI pipelines: `analyzeOwnVoice`, `researchVoiceProfile`, `enrichVoiceProfile`, `generateVoiceSamples`, `captureVoiceSignal`, `distillVoiceDirectives`, `validateVoice`, `batchGenerateSystemVoices` — all return `{ fallback: true }` on error
- `format-style-context.server.ts` — single integration point prepended to every generation
- `schemas.ts` — Zod shapes shared client/server
- `capture-signal.ts` — fire-and-forget client helper

## 3. Generation gate (invariant)

Every generation server fn calls `resolveActiveVoice` → `formatStyleContext` → prepends to system prompt. If no active voice, returns `{ needsVoice: true }` (never 500). Wire into `orchestrate.functions.ts`.

## 4. Second Brain integration (invariant)

On voice create / adopt / duplicate, upsert an `entities` node (`kind='voice'`) and `brain_edges` linking to persona + adopted `SystemVoice` + sample `knowledge_entries`. Rename/delete cascades.

## 5. UI (mobile-first)

- `/settings/voice` — list with active badge, search, "New" FAB opening a bottom sheet (Analyze / From scratch / Persona library)
- `/settings/voice/$id` — single-column editor: 4 haptic sliders, Tone Preview, hold-to-record samples, "Generate more samples", "Voice DNA", "Set active"
- `/settings/voice/$id/learned` — swipeable directive approvals
- `ActiveVoiceBadge` in `ComposerBar` — 2-tap switch, warns when no voice

## 6. Signal capture wiring

`captureSignal()` fires on draft edit, regenerate, approve, reject in Library + composer.

## 7. Rules

- Slider clamp 0–100
- Vocabulary case-insensitive dedupe, preferred/avoid mutually exclusive
- Samples capped at 5 × 2,000 chars, markdown stripped
- Directives sorted `evidence_count desc`, capped 50, `status='active'` only

## 8. Acceptance targets

- New user creates voice in ≤60s via Analyze
- ≥5 profiles with ≤2-tap switcher
- Auto-promotes ≥1 directive after 3 edits
- `validateVoice` score improves with active directives
- Default invariant holds under concurrent edits
- Every generation resolves through `resolveActiveVoice`
- Every voice appears as a Brain node
- All AI pipelines degrade gracefully with `{ fallback: true }`

## Out of scope

- Wiring `formatStyleContext` into non-orchestrator generation flows (follow-up)
- Multi-tenant business accounts
- TTS / audio cloning
