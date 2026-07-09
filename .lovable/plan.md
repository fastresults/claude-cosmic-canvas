## Goal
Make the "mic blocked" moment feel guided instead of a dead-end by detecting the user's OS/browser and showing the exact steps (and, where possible, a direct link) to re-enable microphone access.

## What changes

**1. New helper: `src/lib/platform/mic-help.ts`**
- `detectPlatform()` — parses `navigator.userAgent` + `userAgentData` into one of: `ios-safari`, `ios-chrome`, `android-chrome`, `android-firefox`, `macos-safari`, `macos-chrome`, `macos-firefox`, `windows-chrome`, `windows-edge`, `windows-firefox`, `linux-*`, `unknown`.
- `micHelpFor(platform)` — returns `{ title, steps: string[], deepLink?: { href, label } }`.
  - iOS Safari/Chrome → "Settings → Safari (or Chrome) → Microphone". Deep link: `App-Prefs:` isn't reliable in Safari, so show steps only; on iOS Chrome offer `googlechrome://settings`.
  - Android Chrome → deep link `intent://settings/site_settings/microphone#Intent;scheme=chrome;package=com.android.chrome;end` with fallback text steps.
  - Desktop Chrome/Edge → link to `chrome://settings/content/microphone` / `edge://settings/content/microphone` shown as copy-to-clipboard (browsers block navigation to `chrome://` from a page, so we copy + instruct).
  - Desktop Safari → steps: Safari → Settings → Websites → Microphone.
  - Desktop Firefox → `about:preferences#privacy` (copy + instruct).
  - Fallback → generic "click the lock icon in the address bar → Site settings → Microphone → Allow".

**2. New component: `src/components/shell/MicPermissionSheet.tsx`**
- Uses existing `EveSheet` primitive.
- Shows: platform-specific title, numbered steps, the deep-link button (or "Copy address" for `chrome://` style URLs with a toast), plus a "Try mic again" primary action that calls back into `startRecording`.
- Includes a small "Not your device?" link that reveals a `<select>` to manually pick another platform — covers misdetection.

**3. `src/components/shell/ComposerBar.tsx` updates**
- Replace the inline "Mic blocked… Retry" strip with a single "Fix microphone access" button when `micPermission === "denied"` or `micErr` is set.
- Clicking it opens `MicPermissionSheet` (new state `helpOpen`).
- On first `NotAllowedError`, auto-open the sheet once per session (guarded by a `sessionStorage` flag so it doesn't nag).
- Keep the current recording pipeline untouched.

**4. Small polish**
- When `micPermission === "granted"`, never show any warning UI.
- When permission is `prompt`, the first tap continues to trigger the native browser prompt (no sheet); only failure opens the sheet.

## Technical notes
- Pure client code, no server functions, no schema changes.
- No new dependencies.
- Deep links that browsers refuse to navigate (`chrome://`, `edge://`, `about:`) are handled via `navigator.clipboard.writeText` + toast, since anchor navigation to those schemes is blocked by design.
- iOS PWAs (`display-mode: standalone`) get an extra note that mic permission must be granted in the Safari-hosted first launch.

## Out of scope
- Actually opening OS settings from the web is not possible on iOS Safari or desktop browsers — we can only guide. The plan is honest about that inside the sheet copy.
- No changes to recording, transcription, or onboarding logic.
