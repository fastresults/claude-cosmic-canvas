## Two bugs, one root cause

Adopt on the Persona library is doing less than the user expects (it creates a copy but never selects it) and the UI makes it look like every row is firing at once. Fix both.

### Bug 1 — "All Adopt buttons trigger"

In `src/routes/_authenticated/settings.voice.tsx`, both `PersonaLibrary` (main list) and `NewVoiceSheet` (library tab) render:

```tsx
disabled={adopt.isPending}
```

`adopt.isPending` is a single mutation flag, so while one adopt is in flight **every** row's button greys out — the user reads that as "all of them just triggered."

Fix: only disable / relabel the row whose id matches the in-flight variables.

```tsx
const busyId = adopt.isPending ? (adopt.variables as string | undefined) : undefined;
// per row:
disabled={busyId === s.id}
// optional label swap: busyId === s.id ? "Adopting…" : "Adopt"
```

Applied in both `PersonaLibrary` and `NewVoiceSheet`.

### Bug 2 — "Adopt doesn't set it as default"

`adoptSystemVoice` in `src/lib/voice/voice.functions.ts` inserts a new `voice_profiles` row and returns it, but never:

- sets `is_default = true` on the new row (and unsets it on the user's other voice profiles), or
- updates `profiles.active_voice_id`.

So after Adopt the DefaultsStrip still shows "Pick a voice" (matches the red pill in the screenshot) and every downstream flow that resolves defaults sees nothing. Users hit Adopt expecting "start using this voice now."

Fix (server-side, atomic): after the insert in `adoptSystemVoice`, in the same handler:

1. `update voice_profiles set is_default = false where user_id = context.userId and persona_id is null`
2. `update voice_profiles set is_default = true where id = row.id`
3. `update profiles set active_voice_id = row.id where user_id = context.userId`
4. Log an extra audit entry: `voice.adopted_and_defaulted`.

This mirrors the existing `setDefaultVoiceProfile` behavior (which also flips `active_voice_id`) so the meaning of "default" stays consistent across Adopt and the explicit Star button.

Return shape stays `{ id, name }` so the client keeps working; the caller already invalidates `voice-profiles` and `voice-active`.

### Client cache invalidation touch-up

`NewVoiceSheet.adopt.onSuccess` only invalidates `["voice-profiles"]`. Add `["voice-active"]` so the header pill / DefaultsStrip flip immediately without a page reload. `PersonaLibrary.adopt` already invalidates both via `onAdopted` → parent `invalidate()`, so no change there.

### Files

- `src/lib/voice/voice.functions.ts` — extend `adoptSystemVoice` handler (steps 1–4 above).
- `src/routes/_authenticated/settings.voice.tsx` — per-row `busyId` logic in `PersonaLibrary` and `NewVoiceSheet`; add `voice-active` invalidation in the sheet.

### Out of scope

Redesign of the persona library, samples/copying strategy, and any change to `setDefaultVoiceProfile` (already correct).
