## Problem

The Voice dropdown in the Profile sheet shows "Like Barack Obama Voice" three times. Confirmed via DB: `voice_profiles` has 3 rows with that exact name for the current user (created 14:10, 14:29, 14:38 on 2026-07-15) — real duplicates, not a rendering bug. Same risk exists for any voice created more than once.

## Fix (two layers)

### 1. Database — merge existing duplicates and block new ones

New migration:
- For each `(user_id, lower(trim(name)))` group with >1 row, keep the **oldest** row (canonical id). 
- Repoint any references on the newer duplicates to the canonical id:
  - `profiles.active_voice_id`
  - `default_profiles.voice_id`
  - `voice_signals.voice_profile_id`
  - any other FK to `voice_profiles.id` discovered during the migration write
- Delete the duplicate rows.
- Add `CREATE UNIQUE INDEX voice_profiles_user_name_uidx ON voice_profiles (user_id, lower(trim(name)));` so a second save with the same name updates instead of inserting.

### 2. App — defensive dedupe + friendlier save

- In `settings.default-profiles.tsx` (`CreateProfileSheet`), dedupe `voiceList` by case-insensitive name before passing to the `<Select>`, keeping the first occurrence. Same treatment for the audience/knowledge/domain lists as a small hardening pass (cheap, same pattern).
- In `voice.functions.ts` `upsertVoiceProfile` (or wherever a new voice is created — will confirm on read), if an insert hits the new unique index, update the existing row by name instead of surfacing a DB error. This turns "save again" into an idempotent edit and matches user expectation.

## Out of scope

- No UI redesign of the voice picker.
- No rename of any existing voice — user-visible names stay identical, just unique.

## Verification

- Re-run the same DB query; expect exactly one row per name per user.
- Reopen the Profile sheet; Voice dropdown lists each voice once.
- Save a voice with an existing name from Settings → Voice; confirm it updates the existing row rather than adding a fourth.
