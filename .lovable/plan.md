# Plan: Cinematic 3D Second Brain

Turn `/brain` from a flat React Flow diagram into a living, dimensional constellation — glowing orbs floating in deep space, connected by gossamer light threads, with parallax depth and gravity-like motion. Inspired by the reference: amber suns, halos, pill-tag labels, dark cosmic backdrop.

## Visual target

- **Deep space canvas** — near-black radial vignette, faint nebula haze (CSS radial gradients + noise), subtle drifting starfield.
- **Orbs, not circles** — each node is a sphere with:
  - Radial highlight (top-left specular)
  - Warm core → dim rim gradient
  - Outer halo bloom (multi-stop radial glow)
  - Type-colored (amber = voice/persona, teal = knowledge, violet = domain, rose = campaign, blue = channel/scheduled)
  - Size = importance (edge count / recency)
- **You** = the sun. Larger, brighter, pulsing amber core with animated corona.
- **Edges** = thin light filaments with a traveling shimmer particle (SPEAKS_IN, AUTHORED_BY, etc. tinted by edge kind).
- **Labels** = small dark pill tags with 1px border and backdrop blur, floating just below each orb (matches reference exactly).
- **Depth** — nodes have a z-value; farther nodes are smaller, dimmer, and slightly blurred. Parallax on pointer move.

## Tech approach

Replace React Flow with a custom **react-three-fiber** (`@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`) scene. R3F gives us real 3D, real bloom, real depth for the "amazing" reaction — React Flow can't.

- Orbs: `<mesh>` with `MeshBasicMaterial` + custom shader-lite (or `Sphere` + emissive). Halo = billboarded sprite with radial gradient texture.
- Edges: `<Line>` from drei with additive blending; animated dashOffset for the shimmer.
- Labels: `<Html>` from drei (occlusion-aware) rendering the existing pill styling.
- Layout: force-directed via `d3-force-3d` running in a `useFrame` tick until settled, then gentle idle drift (sin-wave bob per node).
- Postprocessing: `<EffectComposer>` with `Bloom` (threshold ~0.2, intensity ~1.2) + subtle `Vignette` + `ChromaticAberration` at 0.0005 for cinema feel.
- Camera: `PerspectiveCamera` with `OrbitControls` (damped, no zoom past limits, no pan on mobile). Auto-frame on load with a slow dolly-in from far.

## Interaction

- **Hover** → orb scales 1.15, halo intensifies, connected edges brighten, unrelated nodes dim to 20%.
- **Click** → camera flies to the node (drei `CameraControls.fitToBox`), opens the existing `EveSheet` peek.
- **Drag** on empty space → orbit. **Scroll** → dolly. **Pinch** → zoom on touch.
- **Intro** → 1.2s: camera pulls back from inside the "You" sun; bloom fades in; nodes spring into position with staggered scale-up.
- **Idle** → whole constellation slowly rotates (0.02 rad/s) so it feels alive.

## Data layer (unchanged behavior, better shape)

Keep the existing `brain_edges` backfill + realtime subscription and `fetchLabel()` resolution from `BrainCanvas.tsx`. Two additions:

1. **Node importance** — count incoming edges per node → drives orb radius.
2. **Edge kind → color** map (extend the existing `TYPE_COLOR` idea to edges) so filaments are meaningful, not uniform.

No schema changes. No new server functions.

## View switcher

Keep the top pill switcher (Constellation / Timeline / Radial / List / Health). Only Constellation gets the new 3D scene this pass; the others remain "coming next" placeholders as today.

## Files

- **New** `src/components/brain/three/Scene.tsx` — R3F canvas, camera, lights, postprocessing.
- **New** `src/components/brain/three/Orb.tsx` — sphere + halo + label.
- **New** `src/components/brain/three/Filament.tsx` — animated edge line.
- **New** `src/components/brain/three/Starfield.tsx` — background particles.
- **New** `src/components/brain/three/useBrainGraph.ts` — extracts the current fetch/realtime/label logic from `BrainCanvas.tsx` into a hook returning `{ nodes, edges }`.
- **Edit** `src/components/brain/BrainCanvas.tsx` — becomes a thin wrapper: view switcher + `<Scene />` for constellation, existing placeholders for the rest, existing `EveSheet` for peek.
- **Keep** `BrainNode.tsx` / `YouNode.tsx` type color tokens (imported by the new orb component).
- **Remove** React Flow usage from `BrainCanvas.tsx` (package can stay installed in case another view wants it later).

## Dependencies to add

`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `d3-force-3d`.

## Performance guardrails

- Cap simultaneous nodes rendered at 200 (rest folded into a "+N more" cluster orb).
- `frameloop="demand"` when idle, `always` while animating/hovering.
- Halo sprites share one texture; edges share one material.
- Suspense fallback = the current amber burst so first paint stays instant.
- Respect `prefers-reduced-motion`: disable idle rotation, camera dolly, and shimmer.

## Out of scope this pass

- Timeline / Radial / List / Health views (still placeholders).
- Editing nodes inline, drag-to-connect.
- Server-side layout precomputation.
