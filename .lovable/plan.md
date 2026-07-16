## Problem

Three mic buttons render on the same screen (`/create/post-content`) with no signal of priority:

1. **ComposerBar mic** — always-on global bar pinned above the tab bar.
2. **Textarea built-in mic** — `src/components/ui/textarea.tsx` renders its own dictation button whenever `voiceInput` is not explicitly disabled (default is `true`).
3. **SeedInput's HoldToSpeakButton** — the intended primary mic for the create flow.

All three do the same job. Users can't tell which one to press, and pressing the wrong one drops audio into the wrong target (composer vs. seed vs. textarea).

## Rule (global)

> On any given screen, exactly one mic is the primary voice target — the one bound to the input the user is about to fill. Every other mic on that screen is hidden.

Priority, highest first:
1. A mic attached to the currently-focused text input (e.g. SeedInput's HoldToSpeakButton while its textarea is focused/visible).
2. A mic explicitly declared as the screen's "voice target" via a scope provider.
3. The ComposerBar's global mic — fallback only when no scoped mic exists on screen.

Textarea's built-in mic is demoted: never renders when its surrounding form declares its own voice target.

## Design

**New: `VoiceScope` context** (`src/lib/voice/voice-scope.tsx`)
- `VoiceScopeProvider` at the app shell wraps everything and exposes `{ activeOwners: Set<string>, register(id), unregister(id) }`.
- `useVoiceScopeOwner(id)` — hook a mic surface calls on mount to register itself; unregisters on unmount.
- `useHasScopedMic()` — returns `true` when any scoped owner is registered. ComposerBar reads this.

**ComposerBar** (`src/components/shell/ComposerBar.tsx`)
- If `useHasScopedMic()` is true, hide the mic button entirely and shift the composer into text-only mode (the send/submit affordance stays; the seed line remains for quick typed prompts). No layout jump — the mic slot collapses.

**SeedInput** (`src/components/create/shared/SeedInput.tsx`)
- Call `useVoiceScopeOwner("seed-input")` so ComposerBar hides its mic while the create screen is mounted.
- Pass `voiceInput={false}` to the internal `<Textarea>` to kill the redundant textarea mic.

**Textarea primitive** (`src/components/ui/textarea.tsx`)
- Keep the `voiceInput` prop for backward compatibility, but flip the default to **`false`**. Voice input is now opt-in per usage, not opt-out. This kills the ghost third mic across every screen (SeedInput, DefaultProfiles sheet, capture sheets, etc.) without needing to touch each call site.
- Audit for any explicit `voiceInput={true}` — currently none in the codebase; nothing regresses.

**BrainSearch** (`src/components/brain/BrainSearch.tsx`)
- Also register `useVoiceScopeOwner("brain-search")` while the search bar is open, so ComposerBar's mic hides while a scoped mic is present in the overlay.

**Knowledge SpeakSheet**
- Register `useVoiceScopeOwner("speak-sheet")` while the sheet is open. When open, the sheet's mic is the only one on screen (sheet already covers the composer, but this makes the rule uniform).

## Files touched

- **New:** `src/lib/voice/voice-scope.tsx` (context + hooks, ~50 lines).
- **Edited:**
  - `src/components/shell/AppShell.tsx` — wrap children in `VoiceScopeProvider`.
  - `src/components/shell/ComposerBar.tsx` — hide mic when scoped owner present.
  - `src/components/ui/textarea.tsx` — default `voiceInput` to `false`.
  - `src/components/create/shared/SeedInput.tsx` — register scope owner; pass `voiceInput={false}` (explicit for clarity).
  - `src/components/brain/BrainSearch.tsx` — register scope owner while open.
  - `src/components/knowledge/capture/SpeakSheet.tsx` — register scope owner while open.

## Not doing

- Not removing ComposerBar's mic outright — it's still the fallback on screens like the home/thread view where no scoped mic exists.
- Not refactoring `useVoiceDictation` or the shared `HoldToSpeakButton` — those already work; this plan is purely about which mic is visible.
- Not adding UI to explain the rule; the correct behavior is that the user only ever sees one mic, so no explanation is needed.

## Verification

- Playwright: load `/create/post-content` on mobile viewport → assert exactly one `<button aria-label*="speak"|"record">` in the visible viewport (the SeedInput mic). ComposerBar's mic button must not be in the DOM.
- Navigate to `/` (home, no scoped mic) → assert ComposerBar's mic *is* rendered.
- Open BrainSearch → assert ComposerBar mic hides while the search is open, reappears on close.
