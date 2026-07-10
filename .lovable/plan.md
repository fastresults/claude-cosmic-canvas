## Plan — AI-first, mobile-first Brain view workflows

The switcher already toggles five views (Constellation, Timeline, Radial, List, Health). Constellation is built; the other four render "Coming next". Ship them as thumb-reachable, single-column mobile surfaces that each turn the same `useBrainGraph` data into a distinct lens, and give every view a shared **Ask Eve** row so an AI action is one tap away from any signal in the graph.

### Shared foundation

- **`useBrainGraph` stays the single source of truth.** Each new view is a pure client transform over `nodes` + `edges`; no new server functions this turn.
- **Legend filter (`hiddenTypes`) + view state lift** from `BrainCanvas` into a small `BrainViewContext` so every view honors the same type filter, the same "focus node", and the same peek sheet.
- **Shared `AskEveBar` component** pinned above the compose bar in every non-Constellation view: single input + mic, seeded with a context-aware placeholder ("Ask about this week", "Ask about Domains", "Ask about your gaps"). Submitting routes into the existing compose/chat surface with the current view's context (selected node id, date range, or type filter) attached as a hidden preamble. No backend changes — reuses the current chat entrypoint.
- **Peek sheet parity**: tapping any item in Timeline/Radial/List/Health opens the same `EveSheet` peek already used in Constellation, with an "Open in Constellation" action that switches view + focuses the node.

### 1. Timeline (chronological lens)

- Vertical, mobile-first list grouped by day → week → month, newest first, sticky date headers.
- Each row: color dot from `NODE_COLOR`, node label, type chip, relative time ("2h ago"). Long-press = peek sheet; tap = focus.
- Header controls (thumb zone, top): range chips **Today / 7d / 30d / All**, plus the shared legend-filter chip.
- Empty range → AI suggestion card: "Nothing captured in this window. Want to add a source or draft?" with 2 quick-actions (→ Domains capture, → Compose).
- AI-first: an inline "Summarize this week" pill at the top of each week group calls the existing compose chat with the week's node ids as context.

### 2. Radial (You-centered lens)

- Concentric rings around a central **You** avatar, one ring per relationship layer:
  1. Identity (persona, voice, directives)
  2. Knowledge (domains, knowledge, documents)
  3. Audience (audiences, entities)
  4. Output (drafts, images, campaigns, scheduled, channels)
- Ring count adapts to what exists (empty rings collapse). Nodes on each ring are ordered by importance.
- Mobile interaction: pinch/scroll to expand a ring into a horizontal chip strip; tap a chip = peek sheet.
- AI-first: each ring has a "Strengthen this ring" prompt (e.g. Identity ring with 0 voice samples → "Add a voice sample" CTA; Audience ring thin → "Draft an audience"). CTAs deep-link to existing Settings pages.

### 3. List (dense, filterable directory)

- Flat, virtualized list of every node, grouped by type with collapsible sections. Default sort: recency; secondary sort: importance.
- Sticky search bar at top (reuses `BrainSearch` fuzzy match), plus multi-select type filters (also reflected in legend).
- Row: color dot, label, type chip, edge count, "…" menu (Focus in Constellation, Ask Eve about this, Archive if applicable).
- Bulk mode: long-press a row enters selection; footer bar shows "Ask Eve about N items" — pipes selected node ids into the compose chat as context.
- AI-first: a top "Smart list" chip toggles between Recency / Underused / Missing labels — each is a client-side heuristic over the same data (no server work).

### 4. Health (state-of-your-brain lens)

- Single scroll of small "vital" cards, mobile-first one-column:
  - **Coverage** — % of core node types present (You, voice, ≥1 domain, ≥1 audience, ≥1 knowledge). Progress ring + missing-piece CTAs.
  - **Freshness** — days since last knowledge entry, last draft, last scheduled post.
  - **Balance** — bar chart of node counts by type using `NODE_COLOR`; flags over/under-weighted types.
  - **Orphans** — nodes with 0 edges (excluding You); tap → peek + "Connect" action.
  - **Momentum** — 14-day sparkline of new nodes/edges.
- Each card ends with an **Ask Eve** deep-link seeded with that card's finding ("Why is my Audience thin?", "What should I post this week?"). Reuses existing compose chat entrypoint.

### Files

- New: `src/components/brain/views/TimelineView.tsx`, `RadialView.tsx`, `ListView.tsx`, `HealthView.tsx`, `AskEveBar.tsx`, `useBrainViewContext.ts`.
- Edit: `src/components/brain/BrainCanvas.tsx` (route the switcher to real components, lift filter/focus/peek into context, mount `AskEveBar` in non-Constellation views).
- No schema, no server functions, no changes to Constellation rendering or the existing zoom/legend/capture flows.

### Out of scope (call out for a later turn)

- Server-side aggregates or materialized views for Health.
- Cross-view animated transitions.
- Persisting per-view preferences.
- New AI endpoints — Ask Eve reuses the current chat surface.