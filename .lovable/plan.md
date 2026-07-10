## Goal

Add a discreet search on `/brain` that lets the user find and focus any node in the constellation — with an optional voice-to-text mode for hands-free searching.

## UX

1. **Discreet entry point.** A small circular icon button (magnifier) tucked in the top-right of the Brain view, mirroring the aesthetic of the existing pill view-switcher (border `white/10`, `bg-black/50`, backdrop blur). No prominent search bar by default — it stays out of the way of the 3D scene.

2. **Expanded state.** Tapping the icon expands it inline into a slim pill containing:
   - Text input (`placeholder: "Search your brain"`, auto-focus)
   - Mic button on the right (uses existing `HoldToSpeakButton` visual, hold-to-record)
   - Close (×) collapses back to icon
   - Keyboard shortcut `/` opens it on desktop; `Esc` closes.

3. **Results dropdown.** Under the pill, a translucent panel lists up to 8 matches. Each row: type dot (colored per `palette.ts`), label, small type caption. Tap a row →
   - Closes search
   - Opens the existing `EveSheet` peek for that node (same `onPeek` used by orb clicks)
   - Emits a "focus" signal the Scene consumes to smoothly move the camera toward that node and briefly pulse its halo.

4. **Voice mode.** Press-and-hold the mic → records via Web Audio → on release, POSTs a WAV to a new server fn `transcribeQuery` (Lovable AI `openai/gpt-4o-transcribe`, non-streaming for simplicity, ~1s clip). Transcript populates the input and triggers the same filter. Visual state: mic glows amber while holding (reuses `HoldToSpeakButton`).

5. **Empty / permission states.** If mic is denied, mic button hides and a tiny "Enable mic" hint appears (reuses `platform/mic-help`). If no matches: "Nothing yet — try a different word."

## Matching

Client-side fuzzy filter over the already-loaded `nodes` from `useBrainGraph` (`label`, `nodeType`, and the pretty type name). Case-insensitive substring first, then a light rank by:
1. exact label match
2. label starts-with
3. label contains
4. type-name contains

No new DB call for search — the graph is already in memory. Cap at 8 hits, exclude the `you` node.

## Scene focus behavior

Add an optional `focusNodeId` prop to `Scene`. When it changes, a small effect inside the Canvas (using `useThree`) tweens `camera.position` toward the node's laid-out position (keeping distance ≈ `graphRadius * 0.4`) and temporarily disables `autoRotate` for 3s. The target orb receives a brief scale/emissive pulse (add a `focused` prop to `Orb`).

## Voice transcription server fn

New `src/lib/brain/search.functions.ts`:

- `transcribeQuery` — `createServerFn({ method: "POST" })` with `requireSupabaseAuth`, accepts `FormData` with an audio blob (WAV), forwards to `https://ai.gateway.lovable.dev/v1/audio/transcriptions` with `model: openai/gpt-4o-transcribe`, returns `{ text }`. Uses `gatewayFetch` from `@/lib/ai/gateway.server` if compatible, otherwise `fetch` directly with `LOVABLE_API_KEY`. Rejects blobs > 1 MB. Non-streaming.

(Note: `createServerFn` supports FormData via `inputValidator`. We'll validate `data instanceof FormData` and pull `audio`.)

## Files

**New**
- `src/components/brain/BrainSearch.tsx` — the discreet pill, expansion, results list, mic integration, keyboard shortcuts.
- `src/lib/brain/search.functions.ts` — `transcribeQuery` server fn.
- `src/lib/brain/useVoiceQuery.ts` — client hook: start/stop recording via Web Audio, encodes WAV, calls `transcribeQuery`, returns transcript.

**Edited**
- `src/components/brain/BrainCanvas.tsx` — mount `<BrainSearch nodes={…} onPick={…} />` in top-right; pass `focusNodeId` to `Scene`; wire pick → both `setPeek` and `setFocusNodeId`.
- `src/components/brain/three/Scene.tsx` — accept `focusNodeId`, add internal `FocusCamera` component that tweens on change; pass `focused` flag to matching `Orb`.
- `src/components/brain/three/Orb.tsx` — optional `focused` prop → brighter emissive + brief scale bump.
- `src/components/brain/three/useBrainGraph.ts` — export the node list untouched; `BrainCanvas` will call `useBrainGraph` once and pass nodes to both `Scene` (via new prop or lift hook) and `BrainSearch`. Simplest: lift `useBrainGraph()` into `BrainCanvas`, pass `{ nodes, edges }` into `Scene`.

## Acceptance

- Icon in top-right of `/brain` is visually quiet; does not obscure orbs.
- Tap opens input; typing filters nodes live; tap result focuses camera + opens peek.
- Hold mic → speak "resume" → releases → input fills with "resume" → results filter.
- Works one-handed on 375px viewport; expanded pill fits without overlapping the view switcher (search sits top-right, switcher stays top-center).
- No new DB queries for text search; only the transcription endpoint is new.

## Out of scope

- Semantic search across knowledge chunks (already exists via `searchKnowledge` for AI grounding; not needed to find a graph node).
- Persistent search history.
- Multi-select or bulk actions from results.
