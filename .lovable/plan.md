## Problem

When the user presses the mic button (SeedInput on `/create/*`, BrainSearch, and any other HoldToSpeakButton usage), there's no clear signal recording is happening. The button just darkens slightly — no pulse, no waveform, no timer, no haptic beyond the initial tap, no dismissible "recording" state. On mobile this reads as "nothing happened."

## Goal

Give every voice-capture affordance in the app the same unmistakable recording feedback: visual pulse + live level/timer + haptic on start, stop, and cancel. One shared primitive, applied everywhere mic input exists.

## Scope (files to touch)

- `src/components/primitives/HoldToSpeakButton.tsx` — upgrade to the canonical recording button.
- `src/components/create/shared/SeedInput.tsx` — wire the new states + show a "Recording" strip above the composer while active.
- `src/components/brain/BrainSearch.tsx` — replace inline mic with the shared primitive, keep hold-to-talk behavior.
- `src/hooks/useVoiceDictation.ts` — expose live audio level (0–1) via an AnalyserNode so any consumer can render a waveform/pulse. Add haptic hooks.
- `src/components/primitives/RecordingIndicator.tsx` *(new)* — small reusable pill with pulsing dot, mm:ss timer, live level bar, and Cancel button. Used by SeedInput and any future voice surface.
- `src/styles.css` — add a `@keyframes mic-pulse` + `.amber-glow-pulse` utility (token-based, no hardcoded colors) so the button ring pulses in sync with audio.

## Behavior spec

**Idle → Press**
- Instant haptic tap (`navigator.vibrate(8)`).
- Button scales to 1.05, switches to `bg-accent` with pulsing amber ring (2 concentric rings expanding + fading, 1.2s loop).
- Mic icon swaps to a filled "recording" glyph.

**While recording**
- RecordingIndicator appears anchored to the input:
  - Pulsing red/amber dot (uses `--accent` token).
  - Live timer `0:03` updating every second (already tracked in `useVoiceDictation.elapsed`).
  - Thin horizontal level meter driven by AnalyserNode RMS (new in hook).
  - "Cancel" ghost button — releases without sending audio for transcription.
- Button itself keeps the pulsing ring; ring amplitude reacts to live level (subtle, capped) so the user sees their voice is being picked up.
- Screen reader: `aria-live="polite"` announces "Recording started", timer updates silently.

**Release / stop**
- Haptic double-tap (`[10, 40, 10]`).
- Button collapses back; RecordingIndicator morphs into a "Transcribing…" shimmer state (existing `status === "transcribing"`).
- On success: indicator fades out, text lands in the textarea (unchanged).
- On error: indicator turns into an inline error chip with Retry.

**Cancel / pointer-cancel / mic denied**
- Haptic single short buzz.
- Stop recorder, discard buffer (do NOT call transcribe).
- If denied: show existing MicPermissionSheet path; button reverts to disabled with tooltip.

**Tap vs hold**
- Keep hold-to-talk as primary (existing pointer capture).
- Add a min-hold threshold of 250ms: releases under that are treated as a tap → toggle "sticky recording" mode (tap again to stop). This fixes accidental instant releases on mobile that currently yield empty blobs.

## Technical notes

- `useVoiceDictation` gets an optional `AnalyserNode` branch:
  ```
  const audioCtx = new AudioContext();
  const src = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  // rAF loop → compute RMS → setLevel(0..1)
  ```
  Exposes `level: number` alongside `status`, `elapsed`.
- Haptics helper `src/lib/platform/haptics.ts` *(new, tiny)* — wraps `navigator.vibrate` with feature detect + no-op on iOS Safari (which ignores it) so callers don't sprinkle guards.
- All colors via tokens: `--accent`, `--accent-foreground`, `--destructive` for cancel. No hex.
- Respect `prefers-reduced-motion`: pulse animation collapses to a static ring; level meter still renders (informational, not decorative).
- No changes to server functions, transcription contract, or draft flow.

## Out of scope

- Real-time streaming transcription (deltas rendered as you speak) — separate plan.
- Waveform history visualization — the level meter is enough for feedback.
- Redesign of the mic button's resting shape.

## Verification

- Playwright script: navigate `/create/post-content`, press-and-hold the mic button for 2s, screenshot mid-record → assert pulsing ring + timer visible, then release → assert transcribing state → assert final text in textarea.
- Manual: repeat on BrainSearch. Confirm haptic on a real device (can't verify in sandbox — call it out).
