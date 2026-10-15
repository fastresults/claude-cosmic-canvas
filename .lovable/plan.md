# Fix light-mode orb contrast

## Problem
In light mode the orb's amber/yellow tones sit too close to the cream page color, so the ring washes out and fails contrast. Dark mode is unaffected.

## Fix (same approach as the light-mode pass — deepen, don't redesign)
In `src/components/primitives/VoicePoweredOrb.tsx`, light branch only:

1. **Deepen the light palette** — replace honey amber with a burnt bronze (roughly `#B45309`-range) and keep/shift more weight to the deep violet, so the ring's gradient always has a dark anchor against cream.
2. **Darken the core line** — raise the minimum opacity of the ring's crisp core in light mode so the thinnest part of the ring never drops below readable contrast.
3. **Rebalance the gradient sweep** — bias the color mix toward the violet end in light mode so no long stretch of the ring is pure yellow-on-cream.
4. **Keep everything else identical** — same motion, breathing, circling highlight, voice reaction, press haptics, reduced-motion, off-screen pause. Dark mode values untouched.

## Verification
- Screenshot frames in light mode at the user's viewport (1397x857, dpr=2) and confirm the ring reads clearly at all rotation points.
- Confirm dark mode is visually unchanged.
- `bunx tsgo --noEmit` clean, vitest passes.
