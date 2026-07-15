## Problem

Two separate bugs collapse into the same user experience:

1. **"Set as default" doesn't take effect.** On the voice editor and voice list, `setDefaultVoiceProfile` only flips the `is_default` column. It does not set `profiles.active_voice_id`, and its mutation only invalidates `voice-profiles` (not `voice-active`). So after clicking "Set as default":
   - The "Active voice" chip on top does not update.
   - The `ActiveVoiceBadge` above the composer does not update.
   - Every downstream resolver keeps using whatever `active_voice_id` was there before.
2. **Defaults are voice-only.** There is no "default knowledge profile" and no "default domain". The milestone/orchestrator context resolver (`src/lib/workspaces/context.server.ts`) picks the *first* knowledge profile by `created_at` and derives domain/audience from it. The user has no way to pin the ones every workflow should use.

## Fix

Make "default" a single, global, propagated concept per user, spanning **voice + knowledge profile + domain**, and make every AI surface read from one resolver.

### 1. Voice: unify "default" with "active"

- `setDefaultVoiceProfile` becomes the single button users press. In addition to setting `is_default`, it updates `profiles.active_voice_id` to the same id — so "default" and "active" stay in sync.
- Remove the "Set active" / "Use" secondary buttons from the editor and list (or hide them behind an "Override for this session" advanced action). The primary action is **Set as default**.
- Both mutation `onSuccess` handlers invalidate `["voice-profiles"]` **and** `["voice-active"]`.
- Add a toast confirming "X is now your default voice."

### 2. Knowledge profile: add `is_default`

- Migration: add `is_default boolean not null default false` to `public.knowledge_profiles`, plus a partial unique index `(user_id) where is_default` so only one default per user.
- New server fn `setDefaultKnowledgeProfile({ id })` in `src/lib/knowledge/knowledge.functions.ts` — unsets siblings, sets this one, invalidates.
- In `src/routes/_authenticated/settings.knowledge.tsx`, add a "Default" star button on each profile row (mirrors the voice list UX).
- `listKnowledgeProfiles` returns `is_default`.

### 3. Domain: add `is_default`

- Migration: add `is_default boolean not null default false` on `public.domains`, partial unique index per user.
- New server fn `setDefaultDomain({ id })` in `src/lib/settings/settings.functions.ts`.
- Update `settings.domains.tsx` with a "Default" toggle per row.

### 4. Central resolver used by every AI workflow

Create `src/lib/defaults/user-defaults.server.ts` (server-only helper):

```
resolveUserDefaults(supabase, userId) -> {
  voice:            { id, name, ... } | null,
  knowledgeProfile: { id, name, domain, audience } | null,
  domain:           { id, name } | null,
  preset:           { id } | null,
  missing:          string[],
}
```

Priority for each slot: explicit override → `is_default=true` row → most-recent → null.

Refactor callers to use it:
- `src/lib/workspaces/context.server.ts` — replace the "first knowledge profile by created_at" logic and voice lookup with `resolveUserDefaults`.
- `src/lib/voice/voice.functions.ts` — `resolveActiveVoice` delegates to the same helper for the voice slot.
- `src/lib/create/create.functions.ts` and `src/lib/drafts/drafts.functions.ts` — where they currently resolve voice/knowledge ad-hoc, call the shared resolver.
- `src/hooks/useMilestoneAutoDraft.ts` path (server side) already goes through workspaces context, so it inherits the fix.

### 5. UI feedback so the user sees "it worked"

- `ActiveVoiceBadge` re-renders after default change (query key `voice-active` invalidation covers it).
- Settings > Voice: default row gets a solid `default · active` pill so the state is unambiguous.
- Add a small "Your defaults" summary card at the top of `/settings` showing the resolved default voice, knowledge profile, and domain, each linking to the relevant settings page. Confirms globally what every workflow will use.

## Technical details

**Migrations (single migration file):**
```
alter table public.knowledge_profiles
  add column is_default boolean not null default false;
create unique index knowledge_profiles_one_default_per_user
  on public.knowledge_profiles(user_id) where is_default;

alter table public.domains
  add column is_default boolean not null default false;
create unique index domains_one_default_per_user
  on public.domains(user_id) where is_default;
```
No new grants — both tables already have them.

**Server fns touched/added:**
- `setDefaultVoiceProfile` (modified): also `profiles.active_voice_id = id`.
- `setDefaultKnowledgeProfile` (new).
- `setDefaultDomain` (new).
- `resolveUserDefaults` (new server-only helper, not a serverFn).

**Files edited:**
- `src/lib/voice/voice.functions.ts`
- `src/routes/_authenticated/settings.voice.tsx`
- `src/routes/_authenticated/settings.voice.$id.tsx`
- `src/routes/_authenticated/settings.knowledge.tsx`
- `src/routes/_authenticated/settings.domains.tsx`
- `src/routes/_authenticated/settings.index.tsx` (add "Your defaults" card)
- `src/lib/knowledge/knowledge.functions.ts`
- `src/lib/settings/settings.functions.ts`
- `src/lib/workspaces/context.server.ts`
- `src/lib/create/create.functions.ts`, `src/lib/drafts/drafts.functions.ts` (thin adjustments to read from the resolver)
- `src/lib/defaults/user-defaults.server.ts` (new)

## Out of scope

- No changes to Preset default behavior (already handled via `is_default` on presets).
- No changes to voice learning / directives flow.
- No overrides UI ("use a different voice for this one draft") — kept for a follow-up.
