# Library, rebuilt for scale — AI-first, minimal UI

Today's Library dumps every draft full-body in a single scroll. That collapses at 20+ drafts, never mind hundreds. The rebuild keeps Eve's minimal aesthetic but adds the density, filtering, and AI-native retrieval this needs.

## The experience

**One command bar. Everything else is inferred.**

At the top of `/library`: a single input with a mic on the right — "Ask Eve, or search…". Three modes, one bar, no tabs to pick:

- Type a keyword → fast full-text search (Postgres `search_vector` already exists on `drafts`).
- Type or speak a natural-language query ("LinkedIn posts about pricing from last week that I never published") → Eve parses it into structured filters (format, status, domain, campaign, date range, freeform text) and applies them.
- Leave it empty → recent drafts, grouped.

Under the bar: a thin row of **active filter chips** (tap to remove) and a compact toolbar with sort (Recent / Oldest / Highest score) and density toggle (Compact / Preview). No sidebar. No modal filter sheet. The chip row IS the filter UI — everything is added via typing or voice, everything is removed with a tap.

**Results are compact cards by default**, not full-body dumps:

- Line 1: format badge · domain · relative date · status dot (draft / scheduled / posted).
- Line 2: first ~110 chars of body, single line, truncated.
- Line 3 (only if present): score, source count, campaign tag.
- Tap a card → in-place expand to full body + the existing action row (Regen, Tighten, Tone, Schedule, Post now). No route change, no modal — an accordion expand keeps flow.

**Grouping**: results group by date bucket (Today / This week / Earlier) when unsorted-by-score, and by score band when sorted by score. Groups are sticky headers.

**Bulk actions** on long-press / checkbox reveal: Delete, Schedule, Move to campaign. Only surfaces once selection begins — invisible until needed.

**Empty and zero-result states**: Eve suggests the next action ("No LinkedIn posts about pricing yet — want me to draft one?") with a one-tap button that pipes the query into the composer.

**Pagination**: infinite scroll, 30 per page, cursor-based on `(created_at, id)`. Not "Load more" buttons.

## Why this shape

- **AI-first, minimal UI**: users never learn a filter grammar. They ask. Eve translates. The visible surface stays one input + chips + cards.
- **Density that scales**: compact cards mean ~15 drafts visible per screen instead of 1. Expand-in-place preserves the reading model.
- **Voice-native**: the same mic pattern from Home works here — hold, speak a query, Eve filters.
- **Reuses what exists**: `drafts.search_vector` (tsvector), `format`, `status`, `campaign_id`, `arc_node_id`, and `created_at` are already on the table. No schema change needed for v1.

## Build breakdown

### 1. Server functions (new file `src/lib/library/library.functions.ts`)

- `searchDrafts({ q, filters, sort, cursor, limit })` — single endpoint that handles keyword FTS via `search_vector @@ websearch_to_tsquery`, structured filters (`format[]`, `status[]`, `campaignId`, `dateFrom`, `dateTo`), sort, and cursor pagination. Returns `{ items, nextCursor, total }`.
- `parseLibraryQuery({ utterance })` — Claude call that returns structured `{ q, filters }` JSON from natural language. System prompt lists allowed formats/statuses so the model can only produce valid values; falls back to plain-text `q` on ambiguity.
- `bulkDeleteDrafts({ ids })`, `bulkSetStatus({ ids, status })`, `bulkAssignCampaign({ ids, campaignId })` for selection actions.
- `listFormats()` / `listCampaigns()` — small helpers for chip suggestions.

All protected by `requireSupabaseAuth`. No schema changes.

### 2. UI components (new)

- `src/components/library/LibraryCommandBar.tsx` — the input + mic. Debounced text search; mic uses existing `aiTranscribe` then routes long/complex utterances through `parseLibraryQuery`.
- `src/components/library/FilterChips.tsx` — active filters as removable chips.
- `src/components/library/LibraryToolbar.tsx` — sort + density + selection-mode toggle.
- `src/components/library/DraftRow.tsx` — compact card with expand-in-place; reuses existing `DraftCard` internals for the expanded state.
- `src/components/library/GroupHeader.tsx` — sticky date/score band header.
- `src/components/library/BulkActionBar.tsx` — floating bar when items are selected.
- `src/components/library/EmptyResult.tsx` — Eve's suggested next action.

### 3. Rewrite `src/routes/_authenticated/library.tsx`

Replace the current implementation with:
- `useInfiniteQuery` on `searchDrafts` keyed by `[q, filters, sort]`.
- Local state for `q`, `filters`, `sort`, `density`, `selectionMode`, `selectedIds`.
- Compose the new components; no direct data-fetching in child components.

### 4. Keep existing behavior intact

- `listRecentDrafts` stays (used elsewhere, e.g. Brain nodes). No changes to `contentDraft` / `refineDraft` / `saveDraft`.
- `DraftCard` unchanged — reused inside `DraftRow`'s expanded state.

## Out of scope for this pass

- Full-text index performance tuning (already indexed via `search_vector`).
- Semantic/vector search across drafts — the `parseLibraryQuery` NL layer covers most of that value; embeddings can come later if keyword+filter miss.
- Multi-user sharing, comments, or draft versions.
- New tables or columns.

## Technical notes

- Cursor pagination shape: `{ createdAt: iso, id: uuid }` encoded base64 in a single string.
- `parseLibraryQuery` uses `claude-fable-5` via existing `callAnthropic`; result cached client-side for the session so re-runs of the same utterance don't re-hit the API.
- Voice transcript flows: mic → `aiTranscribe` → if utterance ≤ 4 words, treat as raw `q`; else route through `parseLibraryQuery`.
- Reduced-motion honored on expand animation (already global in `styles.css`).
