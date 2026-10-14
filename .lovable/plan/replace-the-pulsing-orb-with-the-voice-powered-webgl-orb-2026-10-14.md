# Replace the pulsing Orb with the Voice-Powered WebGL Orb

## Goal
Swap the current CSS/SVG pulsing `Orb` (`src/components/primitives/Orb.tsx`) for the uploaded `VoicePoweredOrb` — a WebGL shader orb (ogl library) that rotates and ripples in response to microphone volume.

## Recommended approach
Wrap, don't fork: keep the existing `Orb` component as the single public API (same props: `size`, `idleOnly`, `onPress`, `onRelease`, haptics, aria-labels) and swap its visual internals to the new WebGL renderer. Every usage (home ×2, onboarding, auth) keeps working untouched.

## Key decisions

1. **Microphone ownership** — the uploaded component opens its own `getUserMedia` stream. The app already has a recording flow with its own mic stream and level meter. Two mic streams on one device causes echo/permission conflicts. Plan: strip the built-in microphone code from the component and instead accept an external `level` prop (0–1) fed by the app's existing recording level meter. When idle, the orb animates on a gentle built-in time-based motion. This also avoids surprising mic-permission prompts on pages that aren't recording.

2. **SSR safety** — the app server-renders pages; WebGL/ogl is browser-only. Load the renderer via dynamic import inside a mount effect (or behind `ClientOnly`), with the current amber gradient core as the static fallback so first paint never flashes blank.

3. **Dependency** — install `ogl` (small, ~40kb, no native deps).

4. **Theming** — retune the shader's base colors from purple/cyan to the app's amber/violet/rose palette via the `hue` uniform and edited base-color constants, keeping the dark-theme look consistent.

5. **Reduced motion & performance** — respect `useReducedMotion` (freeze rotation/noise), cap devicePixelRatio at 2, pause rendering when offscreen (IntersectionObserver), and fully dispose the GL context on unmount.

## Steps
1. `bun add ogl`.
2. Create `src/components/primitives/VoicePoweredOrb.tsx`: the uploaded shader/renderer, minus its internal microphone code, accepting `level`, `hue`, `active` props; GL setup/teardown in a mount effect only.
3. Rewrite `src/components/primitives/Orb.tsx` to keep its button wrapper, press/haptic/aria behavior and render `VoicePoweredOrb` inside, wiring the existing recording level (where available) into `level`; idle pages get the gentle self-animated mode.
4. Verify all four usages render (home 220px + 56px, onboarding 140px, auth 120px), check reduced-motion, and confirm no mic prompt appears until recording starts.
5. Run `bunx vitest run` and confirm the build stays green.

## Out of scope
- The 3D brain-scene `Orb` in `src/components/brain/three/Scene.tsx` is a different component (three.js) and is untouched.
