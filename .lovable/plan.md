## Plan — Discrete node-type legend in the Brain viewport

Add a small, dismissible legend pinned to the lower-left of the `/brain` canvas that maps each node color to its type. Purely presentational — no data, edge, or three.js changes.

### Component

- New `src/components/brain/BrainLegend.tsx`.
  - Reads `NODE_COLOR` and `TYPE_LABEL` from `src/components/brain/three/palette.ts` (single source of truth — no hardcoded colors).
  - Renders only the node types actually present in the current graph, so the legend stays short (accepts an optional `visibleTypes: Set<NodeType>`; falls back to all types).
  - Each row: 8px color dot (rendered with inline `background` from `NODE_COLOR[type]` — the one place hex-from-palette is allowed, mirroring how `BrainNode` already consumes it) + label in `text-xs text-muted-foreground`.
  - Container: `absolute bottom-3 left-3 z-10`, `rounded-md border border-border/60 bg-background/60 backdrop-blur px-2.5 py-2`, `pointer-events-auto`, `max-h-[45vh] overflow-y-auto`. Safe-area padding on mobile (`pb-[env(safe-area-inset-bottom)]`).
  - Collapsed by default on mobile (`< md`): shows a single "Legend" chip with a small color-swatch cluster; tap to expand. Expanded by default on desktop. State is local; no persistence.

### Wiring

- Mount inside the brain viewport container in `src/components/brain/BrainCanvas.tsx` (or `src/routes/_authenticated/brain.tsx` if the canvas fills the route) as a sibling of the three.js `<canvas>`, inside the same `relative` wrapper so `absolute` positioning is scoped to the viewport, not the page.
- Derive `visibleTypes` from the same graph data the canvas already consumes (`useBrainGraph` result), so the legend updates reactively when nodes appear/disappear.
- Sits above the canvas but below any existing overlays (search bar, node detail sheet) via `z-10`; existing overlays keep their higher z-index.

### Out of scope

- No edge-color legend (nodes only, per request). Easy follow-up if wanted.
- No filtering/toggle-by-type interaction — legend is read-only.
- No changes to palette values, node rendering, or edge rendering.

### Files

- Create: `src/components/brain/BrainLegend.tsx`
- Edit: `src/components/brain/BrainCanvas.tsx` (mount the legend, pass visible types)