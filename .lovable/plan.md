# /create Hub — Implementation Plan

40+ formats behind one shared architecture, voice-first, one-thumb usable at 375px. Adapted to this stack's actual conventions (TanStack Start server functions, existing shell, existing tokens, existing Brain provenance).

## Stack adaptations (differ from raw spec — required)

- **No Supabase Edge Functions for app-internal logic.** This stack rule mandates `createServerFn` in `src/lib/create/*.functions.ts`. "Edge function" in the spec maps to a server function; streaming uses a raw server route (`src/routes/api/create/$formatId.ts`) so the client can consume SSE via `useStreamingGeneration`.
- **Do not add a 6th bottom tab.** Nav is already at 5 (Home / Library / Arcs / Brain / Settings). `/create` becomes the primary action on Home + surfaced from the existing `ComposerBar` "generate" flow + Voice Orb. On desktop, add a Create entry to the top bar. This keeps thumb ergonomics and matches the "Orb is the only global surface" rule.
- **Reuse existing primitives.** `EveSheet` (bottom sheet), `HoldToSpeakButton`, `ComposerBar`, `AskEveBar`, `WorkingDraftProvider`, `writeEdge` (Brain provenance), `buildPresetPrompt` (already implements DOMAIN → VOICE → KNOWLEDGE → PRESET → TASK — extend with FORMAT_RULES). Do not rebuild.
- **One shared drafts table**, not 40. Spec's per-format tables balloon the schema with zero payoff — all columns are identical except `format_id`. Use a single `create_drafts` table with `format_id text not null`; keeps RLS/indexes/queries simple and matches the existing `drafts` table pattern. `content_generations` collapses into the same table (distinguished by `format_id = 'freeform'`).
- **Persist Brain provenance.** Every generation writes a `brain_edges` row via `recordGeneration` (already exists) so `/create` output is first-class in the Brain graph.

## Architecture

```text
src/
  config/createFormats.ts              # registry (single source of truth)
  routes/_authenticated/
    create.tsx                         # hub (layout + <Outlet/>)
    create.index.tsx                   # searchable grid
    create.$formatId.tsx               # per-format page (one file, registry-driven)
    create.$formatId.$draftId.tsx      # resume/edit existing draft
  routes/api/create/
    $formatId.ts                       # POST -> SSE stream (server route)
  lib/create/
    create.functions.ts                # listDrafts, getDraft, saveDraft, archive, deleteDraft, quality, polish, dedupe
    router.functions.ts                # classifyIntent -> formatId (Orb unified router)
    prompt.server.ts                   # extends buildPresetPrompt with [FORMAT_RULES]
    generators.server.ts               # per-category generator implementations (long-form, sequence, media, etc.)
    format-rules.ts                    # FORMAT_RULES strings keyed by format id
  components/create/
    FormatCard.tsx
    shared/{SeedInput,BriefSheet,ContextRail,StreamCanvas,DecisionDock,QualityBadge}.tsx
    media/{ImagePicker,VideoPicker}.tsx
  hooks/{useCreateFormats,useDraft,useDraftAutosave,useStreamingGeneration}.ts
```

## Data model (one migration, not 40+)

```sql
create table public.create_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format_id text not null,
  title text,
  sections jsonb not null default '[]'::jsonb,
  brief_snapshot jsonb,
  preset_id uuid,
  voice_id uuid,
  domain text,
  audience text,
  factor_weights jsonb,
  images jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  status text not null default 'draft',   -- draft | ready | archived
  archived boolean not null default false,
  quality_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.create_drafts (user_id, format_id, updated_at desc);

create table public.create_version_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null references public.create_drafts(id) on delete cascade,
  format_id text not null,
  sections jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.create_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,          -- image | cover | video | slide
  provider text,               -- gemini | nano-banana | sora2 | kling3 | upload
  url text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Each table: GRANT to `authenticated` + `service_role`, ENABLE RLS, owner-only policies on `auth.uid() = user_id`, shared `tg_set_updated_at` trigger.

## Injection contract

Extend existing `buildPresetPrompt` to prepend the ordered blocks and inject a new `[FORMAT_RULES]` block sourced from `format-rules.ts` (length, section headers, tone constraints per format). Final order:

```text
[DOMAIN] → [VOICE] → [KNOWLEDGE] → [PRESET] → [FORMAT_RULES] → [TASK]
```

Grounding preamble ("Ground every factual claim in [KNOWLEDGE]…") already lives in `GROUNDING_SYSTEM`; keep as-is. Signal priority Topic > Domain > Voice > Knowledge enforced in `router.functions.ts` when classifying and in the FORMAT_RULES template.

## Streaming

- Server route `POST /api/create/:formatId` returns `text/event-stream`. Handler auths via bearer, loads preset/voice/knowledge, calls Lovable AI Gateway with `streamText`, emits section deltas as SSE, upserts `create_drafts` on section boundaries, writes `brain_edges` `GENERATED_BY_TOOL` edge on completion.
- Client `useStreamingGeneration` opens `fetch` with `ReadableStream` reader, feeds `StreamCanvas`.
- On generation failure return `200 { fallback: true, message }` per spec.

## Voice Orb / unified router

`classifyIntent(utterance)` server function calls Claude with the registry's `{id,label,category}` list and returns `{formatId, confidence, seed}`. Client:
- confidence ≥ 0.6 → navigate to `/create/:formatId?seed=…&autoStart=1` and stream within 2s.
- confidence < 0.6 → Orb surfaces a two-option picker sheet.

Wire into existing `ComposerBar` generate flow so voice+text share the same entrypoint.

## Quality loop

Server functions: `analyzeDraftQuality`, `analyzeContentImprovements`, `autoPolishContent`, `deduplicateContent`. `QualityBadge` runs on first stream complete. Polish accept/reject sheet writes a `create_version_history` row.

## Media

`ImagePicker` calls `aiImage` (already exists — extend with provider selector: gemini / nano-banana). `VideoPicker` wraps two new server functions `generateSora2Video`, `generateKling3Video`. All results insert into `create_media` and attach to `draft.images` / `draft.videos`.

## Build order (phased — ship value at each step)

**Phase 1 — foundation (registry + one format end-to-end)**
1. `src/config/createFormats.ts` with all 40+ entries.
2. Migration: `create_drafts`, `create_version_history`, `create_media` + RLS/GRANTs/triggers.
3. Shared primitives: `SeedInput`, `BriefSheet`, `ContextRail`, `StreamCanvas`, `DecisionDock`, `QualityBadge`.
4. Hooks: `useCreateFormats`, `useDraft`, `useDraftAutosave`, `useStreamingGeneration`.
5. Routes: `create.tsx`, `create.index.tsx` (hub grid), `create.$formatId.tsx`.
6. Server route `api/create/$formatId.ts` + `prompt.server.ts` + `generators.server.ts` covering the **long-form** category (reference: press-release).
7. `format-rules.ts` for all long-form formats.
8. Home CTA + desktop TopBar entry to `/create`.

**Phase 2 — unified router + Orb**
9. `router.functions.ts` (`classifyIntent`) + Orb wiring through `ComposerBar`.
10. Two-option picker sheet at confidence < 0.6.

**Phase 3 — remaining categories**
11. Sequence, speaking/plans, short-form, campaign/research generators — each is a `generators.server.ts` case + `format-rules.ts` entry; UI reuses `create.$formatId.tsx`.

**Phase 4 — media**
12. `ImagePicker` (gemini + nano-banana + upload + library).
13. `VideoPicker` (Sora2, Kling3) — feature-flag if provider access pending.

**Phase 5 — quality loop + lifecycle**
14. `analyzeDraftQuality`, `analyzeContentImprovements`, `autoPolishContent`, `deduplicateContent`.
15. Version history UI, archive/pin, swipe gestures.
16. Draft list on Library, resume flow `create.$formatId.$draftId.tsx`.

## Acceptance mapping

- Format registry drives hub, per-format page, Orb router, syndication, quality UI ✔
- Voice-only path: Orb → `classifyIntent` → route → stream in <2s ✔
- Every generator: bearer-authed server route + Zod validation + injection order + Brain edge ✔
- Delete draft cascades version history via FK; preset/voice/knowledge untouched ✔
- 375px one-thumb: bottom sheets via `EveSheet`, sticky `DecisionDock`, no modals ✔

## What I will NOT change

- Existing shell, tokens, fonts, Brain graph, presets, voice, knowledge ingestion.
- Bottom nav tab count (adding a 6th tab breaks thumb ergonomics on 375px).
- Supabase Edge Functions — none created; all logic in TanStack server functions/routes per project stack rules.

## Open questions before Phase 1

1. Sora2 / Kling3 — do you have provider access wired, or feature-flag and stub?
2. Registry: keep all 40+ or trim to the ~15 you'll actually ship in v1?
3. Home CTA placement — replace current `ComposerBar` "Generate" affordance, or add a second entry?
