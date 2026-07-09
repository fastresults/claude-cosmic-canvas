# Modernize the Orb

Rework `src/components/primitives/Orb.tsx` only. Keep the amber/violet palette, the same props (`size`, `idleOnly`, `onPress`, `onRelease`), the same haptics, and the hold-to-speak behavior. Every visual upgrade lives inside that one component so Home, Composer, and the working-draft header pick it up automatically.

## Visual direction

Reference: the second uploaded image — a glowing plasma core surrounded by concentric, wavy energy fields. Translated into our dark amber system:

- A **liquid amber core** with animated radial highlights that drift (not a static gradient). Uses `oklch` amber tokens already in `styles.css`.
- A **soft inner corona** that breathes on an irregular rhythm (multi-frequency sine sum) so it never looks looped.
- **Two concentric outer rings** rotating in opposite directions at different speeds, with dashed / gradient conic strokes and low opacity — reads as "something is computing."
- **Orbiting spark particles** (4–6 tiny dots) on elliptical paths at varied radii and speeds, faint violet accents mixed with amber.
- **Wave halo**: an SVG blurred noise/turbulence ring using `<feTurbulence>` + `<feDisplacementMap>` on a circle stroke, animated via a slowly shifting `baseFrequency` seed — this is what gives the "supernatural process" feel.
- **Press state**: rings speed up, particles converge slightly inward, core brightens and saturates, halo pulse tightens. Release returns to idle smoothly.

## Behavior

- Idle animation uses irregular periods (e.g. 5.3s, 7.1s, 11s) layered so pulses never align — avoids the current mechanical loop.
- All motion via `framer-motion` (already used) + one small SVG `<animate>` for turbulence seed. No new dependencies.
- Respect `prefers-reduced-motion` (already enforced globally in `styles.css`) — component degrades to a static core + faint halo.
- `idleOnly` still disables pointer handlers; small sizes (e.g. `size={56}` in the working-draft header) scale rings/particles proportionally so it stays legible.

## Technical notes

- Single file change: `src/components/primitives/Orb.tsx`.
- SVG layer stacked absolutely inside the existing `<button>`; core stays a `motion.span` gradient; rings are SVG `<circle>` with `strokeDasharray` + `motion` rotation; particles are `motion.span` positioned via `transform: rotate(x) translateY(-r)` with independent `duration`s.
- No prop or API changes → no downstream refactors.
- No changes to `styles.css`, tokens, or other components.

## Out of scope

- Sound, STT wiring, or new interaction affordances.
- Palette changes.
- Any other screen or component.
