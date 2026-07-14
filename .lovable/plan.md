# Global speak-or-type on every textarea

## Goal
Anywhere the app renders a multi-line text field, the user can either type OR hold a mic button to dictate. Transcribed text is appended into the same field they'd type in. One rule, one component, applied globally.

## Approach
Upgrade the shared `src/components/ui/textarea.tsx` in place so every existing `<Textarea />` gets the mic automatically — no call-site changes required. This is the only way "global" actually holds; wrapping opt-in would drift.

### New behavior of `<Textarea />`
- Renders the current textarea, plus a small mic button pinned to the bottom-right inside the field (does not overlap typed text — right/bottom padding reserved).
- Tap-to-toggle on mobile, also supports press-and-hold. Shows recording pulse + elapsed seconds; shows "Transcribing…" while the server call runs.
- On success, appends transcript to current `value` (with a space/newline separator) and fires `onChange` with a synthetic event so controlled forms, React Hook Form, and zod resolvers all keep working unchanged.
- Uncontrolled textareas (no `value`) are also supported: writes into the DOM node and dispatches `input`.
- Graceful degradation: if `navigator.mediaDevices` is unavailable, permission denied, or the transcription call fails, the mic hides / shows an inline error and typing still works.
- Escape hatch: `voiceInput={false}` prop to disable on the rare field where dictation doesn't make sense (e.g. code snippets, hidden fields). Default is `true`.
- Respects `disabled` and `readOnly`.

### Reused infrastructure (no new backend)
- Recording: same MediaRecorder + base64 pattern already used in `SpeakSheet.tsx`.
- Transcription: existing `aiTranscribe` server function in `src/lib/ai/ai.functions.ts` via `useServerFn`.
- Iconography: `Mic` / `Square` from `lucide-react`, styled with existing tokens.

### New file
- `src/hooks/useVoiceDictation.ts` — encapsulates getUserMedia + MediaRecorder + transcribe + status; returns `{ recording, status, error, start, stop, toggle, supported }`. Keeps `textarea.tsx` small.

### Files touched
- `src/components/ui/textarea.tsx` — wrap the `<textarea>` in a relative container, add mic button, wire hook, keep forwardRef + all existing props/classNames intact.
- `src/hooks/useVoiceDictation.ts` — new.
- No changes to any call site. The three raw `<textarea>` usages found (`SpeakSheet.tsx` already dedicated to voice; `PasteSheet.tsx`; and inline ones in a couple of settings/onboarding routes) — switch those raw `<textarea>` tags to `<Textarea />` so the rule truly is global. `SpeakSheet.tsx` keeps its dedicated big mic; pass `voiceInput={false}` on its transcript field to avoid a redundant second mic.

## Stress tests
- Controlled + RHF form (MilestonePrepSheet "What are you preparing for?") — verify appended text updates form state and validation.
- Uncontrolled textarea — verify DOM value + input event.
- Mid-recording sheet close / route change — hook cleans up stream + recorder.
- Permission denied → mic button shows disabled state with tooltip; typing unaffected.
- Long recording → status shows elapsed; transcript appends without clobbering user edits made while recording.
- Small textareas (1–2 rows) — mic sits inside without breaking min-height; padding-right reserved.
- Dark mode + focus ring — mic doesn't clip the ring.
- Mobile 390px (current viewport) — 44px tap target, no layout shift.

## Out of scope
- Streaming partial transcripts (current server fn returns final text).
- Language selection UI (auto-detect on server).
- Replacing single-line `<Input />` — user asked about textareas only.
