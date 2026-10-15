# Voice pill doesn't update instantly when selecting a voice

## Why it happens
- The "Use" button correctly saves the choice and asks the app to refresh — but the pill's data comes from `getActiveVoice`, which is a **GET** request. GET responses can be served from the browser's HTTP cache, so the "refresh" returns the old voice.
- There is also no optimistic update: the pill waits for a full server round-trip even when the refresh works, so it visibly lags.

## What we'll do

1. **Instant pill update (optimistic).** The moment you tap "Use", the pill's cached data is set to the voice you picked — before the server replies. If the save fails, it rolls back and shows an error notice.
2. **Stop the stale cache.** Switch `getActiveVoice` from GET to POST so refetches always hit the database, never the HTTP cache.
3. Same treatment on the voice detail page ("Set active" there uses the same path).

## Technical details
- `src/routes/_authenticated/settings.voice.tsx` and `settings.voice.$id.tsx`: add `onMutate` to the `setActive` mutation — `qc.cancelQueries(["voice-active"])`, snapshot previous, `qc.setQueryData(["voice-active"], pickedVoice)`; `onError` rolls back and toasts; `onSettled` invalidates `["voice-active"]` and `["voice-profiles"]`.
- `src/lib/voice/voice.functions.ts`: `getActiveVoice` → `createServerFn({ method: "POST" })`.
- Verification: signed-in Playwright run — tap "Use" on a different voice, assert the top pill text changes immediately (same second, no reload), and stays correct after a hard reload. Clean build + tests.
