## Goal

Simplify Brain labeling: only yellow orbs (`you`, `persona`, `voice_sample`, `directive` — the amber/orange palette) show a small, always-visible readable label. All other orbs stay label-free until hovered, at which point their label appears.

## Changes

`src/components/brain/three/Orb.tsx`:

- Replace the current "core vs peek" logic with a single check: `isYellow = nodeType in { you, persona, voice_sample, directive }`.
- **Yellow orbs**: render a persistent `<Billboard><Html>` pill under the orb — 11px (12px for `you`), medium weight, `rgba(0,0,0,0.7)` background, thin amber border, drop shadow. Slight scale-up on hover.
- **All other orbs**: render the pill only when `isHover || focused`. Same styling scale as before, no transient/rotation-driven reveal.
- Remove the peek-label system entirely: shared `activePeeks` registry, per-frame camera-cone math, fade timers, and cooldown state.
- Keep bob, halo, hover cursor, and click behavior unchanged.

No other files change.
