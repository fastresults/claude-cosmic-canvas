# Domain ingestion — one-click, AI-first

Make it obvious and effortless to feed a domain. Turn `DomainDetailSheet` from a static "tap the +" surface into an ingest workbench: drop files, paste anything, run deep research, all resolving to entries under the current domain.

## What the user sees

Inside a domain sheet (e.g. "Product-led growth"), the top of the sheet becomes an **Ingest zone**:

```text
┌──────────────────────────────────────────────────────────┐
│  Drop files here — or paste a URL, YouTube link, text    │
│  [PDF][DOCX][MD][MP3][URL][YouTube]                      │
└──────────────────────────────────────────────────────────┘

  One-tap sources
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ Upload │ │ Paste  │ │  URL   │ │YouTube │ │Research│
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘

  Recently added …
```

Four one-click flows, all pre-scoped to the current `domainId`:

1. **Dropzone** — full-sheet drop target (uses existing `DesktopDropzone` pattern, scoped to domain). On mobile, tapping opens the file picker.
2. **Smart paste** — a single input that auto-detects: URL → scrape; YouTube URL → transcript; plain text → note. No mode switching.
3. **YouTube** — dedicated tile; paste link, we fetch transcript + metadata, store as entry with `source_type: "youtube"`.
4. **AI deep research** — tile opens a small prompt sheet ("What should Eve research for this domain?"). Runs a grounded research pass via Lovable AI, streams a markdown brief with citations, saves as entry `source_type: "research"`.

Every card in the sheet shows an inline status row while ingesting (parsing / transcribing / researching / embedding) reusing `IngestionStatusStrip`.

## Scope of changes

### New components
- `src/components/knowledge/DomainIngestZone.tsx` — dropzone + smart-paste bar + one-tap tile row. Renders inside `DomainDetailSheet` above `IngestionStatusStrip`. Handles drop/paste detection and routes to the right server fn.
- `src/components/knowledge/capture/YouTubeSheet.tsx` — thin sheet, URL input, calls new `ingestYouTube` server fn.
- `src/components/knowledge/capture/ResearchSheet.tsx` — prompt textarea + "Research" button; streams status; calls new `runDeepResearch` server fn.

### Edited
- `src/components/knowledge/DomainDetailSheet.tsx` — mount `DomainIngestZone` at top; keep `CaptureFab` for parity but demote its visual weight (dropzone is the primary affordance on desktop).
- `src/components/knowledge/CaptureFab.tsx` — add `youtube` and `research` actions so the FAB stays consistent with the tile row.

### New server functions (`src/lib/knowledge/`)
- `youtube.functions.ts` → `ingestYouTube({ url, domain_id })`: extract video id, fetch transcript (YouTube transcript API via fetch; fall back to Lovable AI transcription of audio if unavailable), fetch oEmbed metadata for title/thumbnail, call existing `ingestEntry` with `source_type: "youtube"`, `meta: { videoId, channel, thumbnail, duration }`.
- `research.functions.ts` → `runDeepResearch({ topic, domain_id, domain_name })`: prompt Lovable AI (`google/gemini-3-flash-preview`) with a structured research brief template scoped to the domain; return `{ markdown, citations[] }`; call `ingestEntry` with `source_type: "research"`.
- Extend `ingestEntry`'s `source_type` union to include `"youtube" | "research"`; add labels in `src/components/knowledge/shared.ts` `SOURCE_LABELS`.

### Smart-paste detection (client-side, in `DomainIngestZone`)
- YouTube regex (`youtube.com/watch`, `youtu.be/`) → YouTube flow.
- Any other `http(s)://` → URL scrape flow.
- Everything else → paste-as-note flow (reuses existing `PasteSheet` handler inline, no sheet needed for short text).

## Out of scope
- Voice/domain redesign beyond the ingest zone.
- Changes to embeddings pipeline; new sources ride the existing `ingestEntry` → chunk → embed path.
- LinkedIn / résumé flows (already covered by existing sheets).
- Background job orchestration changes; deep research runs inline with streamed status.

## Technical notes
- YouTube transcripts: try `https://www.youtube.com/api/timedtext` list first; if empty, download audio via `yt-dlp`-style fetch is not viable on Workers — fall back to asking the user to upload the audio, or use a public transcript endpoint. Confirm approach when we hit that fallback.
- Deep research citations stored in `meta.citations` as `[{ title, url }]`; entry `content` is the markdown brief so it feeds the existing embed pipeline unchanged.
- All new server fns use `requireSupabaseAuth` and pass `domain_id` through to `ingestEntry` (already supported).
