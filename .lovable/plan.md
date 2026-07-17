## Goal
Elevate **Audience** to a first-class pillar alongside Voice, Knowledge, and Domain — a robust, AI-generated ICP that flows through every workflow (defaults, profiles, brain graph, create flows, image gen, workspaces, presets, orchestrator).

## Current state (verified)
- `audiences` table is minimal: `id, user_id, name, created_at`. No description, ICP fields, `is_default`, or embeddings.
- `default_profiles` bundles `voice_id + knowledge_profile_id + domain_id` only (no `audience_id`).
- `useUserDefaults` tracks voice / knowledge / domain — no audience slot.
- `DefaultsStrip` shows three pills; no audience pill.
- Drafts have a free-text `audience` column populated per-draft; there's no reusable audience entity linked in.
- Presets inject audience as a plain string. `context.server.ts` (Milestone context) has an `audience` field wired but only from strings.
- Brain graph already has `audience` NodeType + color; edges include `TARGETS_AUDIENCE`; no producer creates those edges today.
- No AI ICP suggestion exists anywhere.

## Design

### 1. Schema (migration)
Extend `audiences` into a rich ICP entity and wire it into the pillar system.

```
ALTER TABLE public.audiences ADD COLUMN
  description text,
  icp jsonb NOT NULL DEFAULT '{}'::jsonb,      -- structured ICP (see shape below)
  emoji text,
  is_default boolean NOT NULL DEFAULT false,
  is_ai_generated boolean NOT NULL DEFAULT false,
  source_domain_id uuid REFERENCES public.domains(id) ON DELETE SET NULL,
  source_knowledge_profile_id uuid REFERENCES public.knowledge_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX audiences_one_default_per_user
  ON public.audiences(user_id) WHERE is_default;

ALTER TABLE public.default_profiles
  ADD COLUMN audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL;

ALTER TABLE public.create_drafts
  ADD COLUMN audience_id uuid REFERENCES public.audiences(id) ON DELETE SET NULL;
-- keep legacy free-text `audience` for backfill/compat; new writes prefer audience_id.
```

`icp` JSON shape (validated in server fn, not in a check constraint):
```
{
  "persona": string,             // "Founders scaling B2B SaaS 5–50 people"
  "role_titles": string[],
  "industries": string[],
  "company_size": string,
  "seniority": string,
  "goals": string[],
  "pains": string[],
  "channels": string[],          // where they consume content
  "tone_preference": string,
  "objections": string[],
  "success_metrics": string[]
}
```

Grants + RLS (repeat the standard pattern from other user-owned tables).

### 2. Server functions — `src/lib/audiences/audiences.functions.ts`
CRUD + defaults + AI generator, mirroring `settings.functions` domain patterns:
- `listAudiences`, `getAudience`, `createAudience`, `updateAudience`, `deleteAudience`
- `setDefaultAudience(id)` — clears others, sets one.
- `suggestAudienceFromContext({ domain_id?, knowledge_profile_id?, focus? })` — calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with the user's domain name, top knowledge chunks (via existing `match_knowledge_chunks` or profile summary), and optional focus text. Uses `Output.object` with a small schema (persona, role_titles, industries, goals, pains, channels — everything else optional; keep the schema tight per the AI SDK rule). Returns a draft `icp` + name + description. UI decides whether to save.
- `generateDefaultAudience()` — one-click "AI, pick my ICP" using the user's current default domain + default knowledge profile; saves as `is_ai_generated: true`, sets it as default if the user has none.

### 3. Defaults integration
- `useUserDefaults`: add `audience` slot, `listAudiences` query, expose in `missing[]` and `ready`. `DefaultSlot` becomes `"voice" | "knowledge" | "domain" | "audience"`.
- `DefaultsStrip`: add an **Audience** pill (Users icon) alongside the other three; links to `/settings/audiences`. Missing state uses the same warning treatment.
- `RequireDefaultsGate`: require audience before create flows run.

### 4. Profiles integration
- Extend `default_profiles` schema use in `profiles.functions.ts` and `useDefaultProfiles`: include `audience_id`; on `apply`, set all four defaults (voice, knowledge, domain, audience) in one transaction.
- Update `settings.default-profiles.tsx` editor with a 4th selector.

### 5. New settings page — `src/routes/_authenticated/settings.audiences.tsx`
List/create/edit audiences with an inline "✨ Generate with AI" button that calls `suggestAudienceFromContext` prefilled from the current default domain + knowledge. Rich editor for each ICP field. `is_default` star. Emoji picker (matching Domains UX).

Add nav entry in `settings.index.tsx`.

### 6. Prompt / workflow injection (the systemic part)
Every place that assembles context for a model call adds `[AUDIENCE]` deterministically after `[DOMAIN]`, before `[VOICE]`. Files touched:
- `src/lib/presets/injection.ts` — take a structured `audience: { name, icp } | null` instead of `audiences: string[]`; render as a compact multi-line block (persona, pains, goals, channels). Update all call sites (`create.functions.ts`, `drafts.functions.ts`, workspace actor).
- `src/lib/workspaces/context.server.ts` — resolve audience from `workspace_items.audience_id` → full ICP row; render structured block.
- `src/lib/orchestrator/system.server.ts` — insert `[AUDIENCE]` in the Milestone block and expose the active audience to Eve's system prompt so orchestrated actions inherit ICP context.
- `src/routes/api/drafts/generate-image.ts` — replace the string `[AUDIENCE] ${draft.audience ?? "general"}` with `name + one-line persona + top 2 pains + top 2 channels` derived from the linked audience row (fallback to legacy string).
- `src/lib/create/create.functions.ts` — new drafts default to the user's default `audience_id`; `create_drafts.audience` (legacy) is still populated with the audience's `name` for backward compatibility.
- `src/lib/create/format-rules.ts` — channel-aware social prompts already reference audience; make them consume ICP `tone_preference` and `channels` when present.

### 7. Brain graph integration
- `useBrainGraph.ts` `fetchLabel` already handles `audience` (returns `audiences.name`). Emit `TARGETS_AUDIENCE` edges from:
  - `create_drafts` (on save/publish) → `audience_id`
  - `default_profiles` (via server fn) → `audience_id`
  - `workspace_items` → `audience_id`
  Add these writes in the same server fns that already write brain edges for domain/knowledge (see existing pattern in `drafts.functions.ts`).
- `TYPE_HOVER_FALLBACK` already includes `"Audience"`.

### 8. Draft UI
- Add an **Audience** picker chip next to the existing Voice/Knowledge/Domain chips in the composer/brief. Default to user's default audience, allow per-draft override, "✨ Generate for this draft" opens a modal that runs `suggestAudienceFromContext` seeded by the draft's topic.

### 9. Backfill
Data migration: for each user, if they have any drafts with non-null `audience` text and no `audiences` rows, create one `audiences` row per distinct value with `name = value`; set `audience_id` on those drafts; mark the most-used one as `is_default`.

### 10. Global rule (memory)
Add to `mem://index.md` Core:
> "Audience is a first-class pillar (with Voice, Knowledge, Domain). Every generation prompt, defaults check, profile bundle, and brain edge must include audience."

## Files touched
- `supabase/migrations/<new>.sql` — schema + grants + RLS + backfill
- `src/lib/audiences/audiences.functions.ts` (new)
- `src/lib/audiences/suggest.server.ts` (new — AI ICP generator)
- `src/hooks/useUserDefaults.ts`
- `src/hooks/useDefaultProfiles.ts`
- `src/components/settings/DefaultsStrip.tsx`
- `src/components/settings/RequireDefaultsGate.tsx`
- `src/routes/_authenticated/settings.audiences.tsx` (new)
- `src/routes/_authenticated/settings.index.tsx`
- `src/routes/_authenticated/settings.default-profiles.tsx`
- `src/lib/profiles/profiles.functions.ts`
- `src/lib/presets/injection.ts` (+ all callers)
- `src/lib/workspaces/context.server.ts`
- `src/lib/orchestrator/system.server.ts`
- `src/lib/create/create.functions.ts`
- `src/lib/create/format-rules.ts`
- `src/lib/drafts/drafts.functions.ts`
- `src/routes/api/drafts/generate-image.ts`
- `src/components/brain/three/palette.ts` (verify audience color/label)
- Composer chip additions where Voice/Knowledge/Domain chips render
- `mem://index.md`

## Rollout order
1. Migration + backfill.
2. Server fns + AI suggester.
3. Defaults + Profiles wiring.
4. Settings page.
5. Prompt injection everywhere.
6. Brain edges + composer chip.
7. Memory rule.

## Verification
- New user: /settings/audiences empty → "✨ Generate default audience" produces a saved ICP → DefaultsStrip shows Audience pill filled.
- Existing user: legacy free-text audiences appear as new rows; default set.
- Create a draft: ICP is in the model context; inspect `[AUDIENCE]` block via server logs.
- Brain graph shows `TARGETS_AUDIENCE` edges from drafts and profiles.
- Switching a profile updates all four defaults at once.
