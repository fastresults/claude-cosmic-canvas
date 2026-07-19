# Second Brain — Visual & Interaction PRD (Portable)

Spec to replicate the 3D "constellation" second-brain surface in another app. This is **look, feel, motion, and interactivity only**. The consuming app supplies its own data shape; only the minimal render contract is defined.

---

## 1. Render Contract (the only data assumptions)

The renderer expects two arrays. Map your app's entities to this shape at the boundary.

- **Node** — `{ id, nodeType, label, importance }`
  - `nodeType`: enum key used to pick color, base size behavior, and whether the label persists.
  - `label`: human string (never generic like "Draft"; blank is allowed — hover falls back to `"<TypeLabel> · <last-4-of-id>"`).
  - `importance`: 0..1, drives radius: `0.35 + importance * 0.12`.
- **Edge** — `{ id, source, target, kind }`
  - `kind`: enum key used to pick edge color.
- One node with `id === "you"` is required. It is pinned at origin and rendered as a larger amber "self" orb (radius `1.4`).

---

## 2. Tech Stack (exact)

- React 18/19, TypeScript.
- `three` ^0.185, `@react-three/fiber` ^9, `@react-three/drei` ^10 (`OrbitControls`, `PerspectiveCamera`, `Html`), `@react-three/postprocessing` ^3 (`EffectComposer`, `Bloom`, `Vignette`).
- `d3-force-3d` ^3 for layout.
- `framer-motion` ^12 for the intro burst.
- `vaul` for the bottom-sheet "peek" surface (any drawer lib works — behavior spec below).
- Tailwind for HUD chrome. No hardcoded color utilities in HUD; use semantic tokens.

---

## 3. Color System

Colors live in two flat maps keyed by node/edge type. Three.js needs hex, so these are literal hex, **not** CSS variables.

### Node colors (hex)
```
you         #f5b642    persona    #f5b642
voice       #e89838    directive  #d97b2b
domain      #a78bfa    audience   #c4b5fd
knowledge   #5eead4    entity     #34d399
draft       #e5e7eb    image      #f0abfc
campaign    #fb7185    channel    #60a5fa
scheduled   #38bdf8    mcp_client #94a3b8
preset      #facc15    document   #5eead4
```
Amber family = identity/voice. Violet = domain/audience. Teal = knowledge. Neutrals = drafts/tools. Warm reds/blues = campaigns/channels/scheduled. Rename freely — the family logic is what matters.

### Edge colors (hex)
```
AUTHORED_BY / SPEAKS_IN / USES_VOICE   #f5b642
EXPERT_IN / SCOPES_DOMAIN              #a78bfa
TARGETS_AUDIENCE                       #c4b5fd
SOURCED_FROM / REFERENCES_DOC          #5eead4
PART_OF                                #fb7185
SCHEDULED_TO                           #38bdf8
PUBLISHED_ON                           #60a5fa
GENERATED_BY_TOOL / REGENERATED_FROM   #94a3b8
REFERENCES                             #e5e7eb
```

### Scene background
Radial gradient painted on the canvas `style`, not a three material:
```
radial-gradient(circle at 50% 55%,
  #1a1208 0%, #050303 60%, #000 100%)
```
Warm amber-black core, deep black periphery. This is what gives the app its signature "brass in the dark" mood.

---

## 4. Scene Composition

Canvas config:
- `dpr={[1, 1.75]}`, `performance={{ min: 0.5 }}`.
- `gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}`.
- `PerspectiveCamera` initial `position={[0, 2, 22]}`, `fov={55}`.
- `ambientLight intensity={0.4}` (no other lights — everything uses `MeshBasicMaterial` + bloom).

Layers, back to front:
1. **Starfield** — 800 `THREE.Points` on a spherical shell, `r = 80 * (0.6..1.0)`, uniform on sphere via `phi = acos(2*rand-1)`. Material: `pointsMaterial size 0.08, sizeAttenuation, color #f5e6c8, opacity 0.55, depthWrite false`. Rotates `y += delta * 0.01` (barely perceptible parallax).
2. **Filaments (edges)** — thin additive `LineBasicMaterial`, `opacity 0.28` normal / `0.06` dimmed. Along each edge, a **traveling shimmer**: `SphereGeometry(0.06)`, additive, `opacity 0.9`, position lerps `start→end` on `t = (clock * 0.35) % 1`. This is the "signal is flowing" motif — mandatory.
3. **Orbs (nodes)** — three concentric pieces per orb:
   - Additive **halo sprite** (radial-gradient canvas texture, 256px, stops `0→0.9, 0.25→0.35, 0.55→0.08, 1→0`), tinted by node color. Base scale `radius * 6`. Opacity `0.7` (`0.9` for "you").
   - **Core** `SphereGeometry(radius, 20, 20)` with `MeshBasicMaterial(color)`. No lighting — flat, bloom does the work.
   - **Specular highlight**: offset white sphere at `(-0.3r, +0.3r, +0.6r)`, radius `0.35r`, opacity `0.55`. Fakes a wet/glass reflection.
4. **Postprocessing** — `EffectComposer` with:
   - `Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.6} mipmapBlur`.
   - `Vignette offset={0.2} darkness={0.85}`.

---

## 5. Layout (d3-force-3d)

Deterministic, pre-computed on the CPU — nodes don't jitter at runtime.
- `forceSimulation(nodes, 3)` (3D).
- `forceManyBody().strength(-30)`.
- `forceLink(edges).distance(6).strength(0.5)`.
- `forceCenter(0, 0, 0)`.
- `forceCollide(1.2)`.
- Pin `you` with `fx=fy=fz=0`.
- Run `200` ticks then stop; freeze positions into a `Map<id, [x,y,z]>`.
Recompute only when the node/edge set changes.

---

## 6. Camera Behavior

- **AutoFit** — on mount and on resize, position the camera so the graph's max radius fits the smaller of vertical/horizontal FOV × `1.05`. Camera sits at `(0, R*0.15, dist)`. Skip if delta from last applied distance is `< 0.5` to avoid feedback loops.
- **AutoRotate** — `OrbitControls autoRotate autoRotateSpeed={0.35}`, disabled while a node is focused.
- **Focus tween** — on focus, compute a target point 60% of `max(R*0.35, 6)` from the node along its outward direction; `camera.position.lerp(target, 0.08)` each frame for ~1.4s, `lookAt(0,0,0)`. Then release.
- **Zoom controller** — imperative handle exposing `zoom(factor)` which scales the camera's distance from origin, clamped `[5, 200]`. Wire to `+ / −` HUD buttons.
- **OrbitControls** — `enablePan={false}`, `enableDamping`, `dampingFactor={0.08}`, `minDistance={5}`, `maxDistance={200}`.

---

## 7. Motion / Per-frame Animation

All driven by `useFrame(t = clock.elapsedTime)`:
- **Idle bob** on every orb: `group.y = basePos.y + sin(t * 0.6 + basePos.x) * 0.08`. Phase-offset by x so the whole field breathes asynchronously.
- **"You" pulse**: core scale `1 + sin(t * 1.5) * 0.04`.
- **Halo scale**: target `radius * 6 * (hovered||focused ? 1.6 : 1) * (focused ? 1 + sin(t*3)*0.15 : 1)`, then `scale.lerp(target, 0.15)`. Focus therefore breathes at ~0.5 Hz while hover just inflates.
- **Filament shimmer**: `position.lerpVectors(start, end, (t*0.35)%1)`.
- **Starfield yaw**: `rotation.y += delta * 0.01`.

Do not add per-orb random rotation, spin, or wobble beyond the above. The overall effect must read as *calm gravity*, not a screensaver.

---

## 8. Labels

Rendered via `drei` `<Html center>` beneath the orb (`y = -radius - 0.4`), `pointerEvents: none`, `zIndexRange={[100, 0]}`.

Persistence policy:
- Types in the **persistent set** (identity/voice/knowledge tier: `you, persona, voice, directive, knowledge, document`) show labels always — provided a real title exists.
- **Focused** node always shows label.
- All others show label only on hover.
- Never render a generic placeholder ("Draft", "Content"). If `label` is blank, hover shows `"<TypeLabel> · <last-4-of-id-uppercased>"`.

Chip styling:
```
padding: 2px 6px
font-size: 8px (10px for "you")
font-weight: 500
color: white
background: rgba(0,0,0,0.75)
border: 1px solid <nodeColor>66     // 40% alpha
box-shadow (idle):  0 2px 8px <nodeColor>22
box-shadow (hover): 0 4px 20px <nodeColor>55
text-shadow: 0 1px 3px rgba(0,0,0,0.95)
transform: scale(1.15) on hover, 200ms ease-out
```

---

## 9. Interaction

- **Hover** an orb → set global `hovered` id. Compute a *related set* = `{hovered} ∪ neighbors via edges`. All non-related nodes and edges render **dim** (`opacity 0.25` for orbs, `0.06` for edge lines, `0.15` for shimmer). Cursor becomes `pointer`.
- **Click** an orb → open the Peek Sheet (see §11), set `focusId`, disable auto-rotate, trigger camera focus tween.
- **Close sheet** → clear both `peek` and `focusId`; auto-rotate resumes.
- **Search** (`/` key or magnifier button) → command-palette style. Picking a result focuses that node *and* opens its sheet.
- **Legend toggle** → hides all nodes of that type; edges incident to hidden nodes disappear too. Layout is recomputed only if the node set changes (it does when hiding).

Pointer events must `stopPropagation()` on orb enter/leave/click so OrbitControls don't swallow them.

---

## 10. HUD Chrome (absolute-positioned over the canvas)

Everything HUD uses the same recipe: **frosted dark pill**.
```
border: 1px solid rgba(255,255,255,0.10)
background: rgba(0,0,0,0.50–0.70)
backdrop-filter: blur(12px)
rounded-full (or rounded-md for stacked control blocks)
```

- **View switcher** — top-center. Small segmented control (`text-[11px]`, `px-3 py-1`). Active pill = `bg-white/15 text-white`; inactive = `text-white/50 hover:text-white/80`. Views: Constellation · Timeline · Radial · List · Health.
- **Search** — top-right. Collapsed = 36px round icon button; expanded = pill input with mic + close. Mic recording state: amber glow ring pulses with mic level (`box-shadow: 0 0 0 2px oklch(0.82 0.14 82 / .35+lvl*.5), 0 0 (6+lvl*20)px oklch(0.82 0.14 82 / .6)`), plus a pinging halo. Results dropdown: `rounded-2xl bg-black/70 backdrop-blur`, each row has a color-dot with `box-shadow: 0 0 8px <color>` and a right-aligned `TYPE_LABEL` in `text-[10px] uppercase tracking-wider text-white/40`.
- **Zoom** — bottom-right (`bottom-24` on mobile, `bottom-3` on desktop, to clear the bottom nav). Vertical stack of `+` / `−` icon buttons in a bordered rounded rect. `env(safe-area-inset-bottom)` respected.
- **Legend** — bottom-left, same offset rules. Collapsed = row of first 5 color dots + word "Legend" + chevron. Expanded = scrollable list (`max-h-[40vh]`), each row a color dot (`h-2.5 w-2.5`, `box-shadow: 0 0 6px <color>` when active, none when hidden) + type label. Hidden types render at `opacity-40`. Persist expanded state = `matchMedia("(min-width: 768px)").matches` on first render.

---

## 11. Peek Sheet

Bottom sheet (`vaul` `Drawer`, or any equivalent). Fixed spec:
- Max height `85dvh`, rounds top corners (`rounded-t-2xl`), border-top, `bg-surface`.
- Full-width overlay `bg-black/60 backdrop-blur-sm`.
- 40×6px handle bar top-center.
- Title = node label. Body opens with an uppercase kicker for the node type (`text-xs uppercase tracking-wider text-muted-foreground`), then app-specific detail.
- Closing the sheet must also clear `focusId` so camera and auto-rotate reset.

---

## 12. Intro Choreography

On mount of the constellation view, render an absolutely-positioned amber burst behind the HUD:
```
initial: { opacity: 1, scale: 0 }
animate: { opacity: 0, scale: 6 }
duration: 1.1s, ease: [0.2, 0.8, 0.2, 1]
size: 96px, radial-gradient(circle, #f5e6c8 0%, #f5b642 40%, transparent 70%)
```
Fires once per mount. It masks the first frame of layout and reads as "brain igniting."

---

## 13. Performance Budget

- Sphere geometry `[radius, 20, 20]` — do not raise segments.
- Bloom must be `mipmapBlur`; without it, fill-rate collapses on integrated GPUs.
- Cap DPR at 1.75.
- One shared halo texture across all orbs (module-level singleton, generated once via `<canvas>`).
- Layout runs on the main thread but only when the node/edge set changes; 200 ticks × <500 nodes is safe. Beyond ~1500 nodes, move to a Web Worker.
- Filaments: one `THREE.Line` + one shimmer mesh per edge. Comfortable up to ~600 edges. Above that, batch into a single `BufferGeometry` with per-vertex colors.

---

## 14. Accessibility & Input

- All HUD buttons have `aria-label`. Toggle buttons expose `aria-pressed`.
- Keyboard: `/` opens search, `Esc` closes it.
- Focus ring uses the app's global `:focus-visible` amber ring.
- Respect `prefers-reduced-motion`: disable auto-rotate, filament shimmer, idle bob, and the intro burst; keep hover halo lerp and camera focus tween but shorten focus tween to 400ms.
- Mobile: touch pan/orbit is inherited from `OrbitControls`; HUD is clear of the bottom nav via `bottom-24 sm:bottom-3`.

---

## 15. Definition of Done (visual)

A viewer opening the surface cold must see, within one second:
1. Warm amber burst dissolving from center.
2. Amber "You" orb pulsing at origin with a persistent tiny label.
3. Slowly rotating field of colored orbs, each haloed and softly bobbing.
4. Faint drifting stars behind everything.
5. Additive filaments between related orbs with a bead of light traveling along each.
6. Frosted-glass HUD: view switcher (top-center), search (top-right), legend (bottom-left), zoom (bottom-right).
7. Hovering an orb dims the rest of the graph and enlarges its halo; clicking opens a bottom sheet and the camera glides toward it while auto-rotation stops.

If any of the seven are missing, the port is incomplete.
