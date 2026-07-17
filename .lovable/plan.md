## Goal

On the Brain constellation (`/brain`), give the important "core" orbs a persistent, balanced text label, and as the constellation slowly rotates, briefly reveal small labels (~3s) on the non-core orbs closest to the camera's front lens.

## Current state (verified)

- `src/components/brain/three/Orb.tsx` renders every orb with a tiny 10px pill label via `<Html>`. It's small, appears on all orbs simultaneously, and only enlarges on hover.
- `src/components/brain/three/Scene.tsx` auto-rotates the group via `OrbitControls autoRotate` when nothing is focused.
- Node importance: `you` = 10; others = `min(6, 1 + edgeCount)`. This gives a natural "core" tier (importance ≥ 4) plus the `you` sun.

## Design

### 1. Core orb labels (persistent)

Treat an orb as "core" when `isYou || importance >= 4` (the sun + hub category nodes visible as the large glowing orbs in the screenshot).

For core orbs:
- Label always visible (no fade), regardless of camera angle.
- Larger, balanced typography: 12px, medium weight, slightly stronger pill (bg `black/70`, subtle border in the orb's own color at 40% alpha).
- Positioned just under the orb, billboarded so it always faces the camera.
- Hover still scales up, but base state is already readable.

### 2. Peek labels on non-core orbs (rotating reveal)

Non-core orbs (`!isYou && importance < 4`) get a small transient label that appears only when the orb is currently near the camera's forward axis, and stays visible ~3s before fading.

Mechanics, computed per frame in `Orb.tsx`:
- Compute the orb's world position dot the camera-forward vector to get an "in front of viewer" score.
- Also compute normalized-device-space distance from screen center; require it inside a small cone (e.g. dot > 0.85 relative to camera forward, and within ~30% of screen center).
- When an orb enters that cone, mark `visibleSince = now` and fade the label in over 250ms.
- Keep it visible for 3000ms, then fade out over 400ms, even if it stays in the cone (so labels don't linger and stack). Re-eligible after a 2s cooldown once it leaves the cone.
- Cap concurrent peek labels to ~4 at a time via a lightweight shared registry (a module-level `Set` with timestamps in `Orb.tsx`) so a dense cluster doesn't produce a wall of text.
- Peek label styling: 9–10px, low-contrast white on translucent black pill, no border, faint drop-shadow. Never shown for hover — hover uses the existing scale-up behavior on top.

Hover / focus always overrides: a hovered or focused orb shows its full label regardless of tier or cone.

### 3. Layering & performance

- Continue using `<Html distanceFactor>` inside `<Billboard>` so labels scale with zoom and stay readable.
- Skip the peek-label DOM entirely (`return null` for the `<Html>` child) when opacity is 0, to avoid 30+ hidden DOM nodes.
- All computation stays inside the existing `useFrame` in `Orb.tsx`; no changes to `Scene.tsx` layout or edges.

## Files to change

- `src/components/brain/three/Orb.tsx` — split label rendering into `CoreLabel` (persistent, larger) vs `PeekLabel` (transient, front-cone driven); add per-frame cone check + shared visibility registry.

No schema, route, or data changes.

## Out of scope

- Changing rotation speed, edge visuals, or the `you` sun styling.
- Adding a legend or a toggle for label density (can follow if desired).
