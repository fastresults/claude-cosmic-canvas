## Knowledge Base — Plan

Grounds every AI generation in the user's real material. Extends the existing `knowledge_entries` table rather than replacing it; adds profiles, chunks, and an ingestion job log.

### 1. Database (single migration)

New tables in `public`, RLS on, GRANT to authenticated + service_role.

- **`knowledge_profiles`** — `id`, `user_id`, `name`, `kind` (`personal|client|campaign`), `parent_profile_id` (nullable, self-FK), `created_at`. Seed one `personal` row per user via trigger on first entry.
- **`knowledge_chunks`** — `id`, `entry_id` (FK cascade), `user_id`, `chunk_index`, `content`, `embedding vector(1536)`. HNSW cosine index.
- **`knowledge_ingestion_jobs`** — `id`, `user_id`, `entry_id`, `status` (`queued|running|done|error`), `error`, timestamps. Realtime publication enabled.

Extend existing **`knowledge_entries`**: add `profile_id uuid`, `source_type text` (paste|url|upload|audio|voice_memo|linkedin|resume), `tags text[]`, `pinned bool`, `archived_at timestamptz`, `use_in_next_gen bool`. Keep existing `embedding vector(1536)` as the entry-level summary vector; chunk vectors live in `knowledge_chunks`.

Postgres function **`match_knowledge_chunks(user_id, profile_chain uuid[], query vec, k int, tag_filter text[])`** — cosine search filtered by chain + optional tags, returns chunk + entry title + source_type.

RLS: every table scoped to `auth.uid() = user_id`. All embeddings via `google/gemini-embedding-2` (default) at **1536 dims** using OpenAI 3-small equivalent, or resize to 3072 — using 1536 since the existing column is already `vector(1536)`; therefore use `openai/text-embedding-3-small` for embeddings to match column dimensions. (Documented in code so future switches resize the column.)

### 2. Server functions (TanStack `createServerFn`, not edge functions)

App-internal — placed in `src/lib/knowledge/*.functions.ts`, all guarded by `requireSupabaseAuth`:

- `parseDocument` — accepts base64 file + mime; PDF/DOCX/MD/TXT → cleaned markdown + `detectedKind` heuristic. PDF via `pdfjs-dist`, DOCX via `mammoth`.
- `scrapeUrl` — fetch → strip chrome (readability-style) → title + markdown + OG.
- `scrapeLinkedIn` — LinkedIn URL → structured JSON (`full_name`, `headline`, `about`, `roles[]`, `education[]`, `skills[]`, `achievements[]`) via third-party scraper. **Requires `LINKEDIN_SCRAPER_KEY`** — will prompt user via `add_secret` when they first use it, with a fallback provider recommendation (Proxycurl / RapidAPI). On failure → `scrapeUrl`.
- `extractResume` — parsed résumé markdown → same structured JSON schema as LinkedIn (via `aiThink` with a strict JSON schema prompt). Zod-validated.
- `transcribeAudio` — reuses existing `aiTranscribe` (Lovable AI STT).
- `embedEntry` — chunks (~800 tokens, 100 overlap, sentence-aware), embeds each chunk via `aiEmbed`, upserts `knowledge_chunks`, writes summary embedding to `knowledge_entries.embedding`. Updates `knowledge_ingestion_jobs`.
- `searchKnowledge` — resolves active profile chain, embeds query, calls `match_knowledge_chunks`, returns top-K with attribution.
- `ingestEntry` — orchestrator: creates entry + job row, dispatches per `source_type`, chains résumé auto-extract when `detectedKind='resume'`, calls `embedEntry`.

Retrieval + injection hook `buildGroundedPrompt({ task })` used by every generation path:
```
[DOMAIN] ... [VOICE] ... [KNOWLEDGE]
- <title> (source_type)
  <chunk>
...
[TASK] <user prompt>

System: Ground every factual claim in [KNOWLEDGE]. Omit unsupported claims. Never fabricate roles, companies, dates, or numbers.
```
Wire into existing `aiThink` callers under `src/lib/orchestrator` and `content.functions.ts`. Log token counts + retrieved chunk IDs to `brain_edges` (`REFERENCES` edges) for provenance and tuning.

### 3. Mobile-first UI (Settings → Knowledge)

Rewrite `src/routes/_authenticated/settings.knowledge.tsx` around a mobile-first feed. New components under `src/components/knowledge/`:

- **`ProfileSwitcherPill`** — persistent top pill, tap → `EveSheet` picker listing profiles by kind with "Create profile" CTA. Persists active profile in `localStorage` + URL search param.
- **`CaptureFab`** — bottom-right FAB expanding radially to five labeled actions: **Speak · Paste · URL · Upload · LinkedIn**. Each opens a dedicated `EveSheet`:
  - Speak → `HoldToSpeakButton` (existing primitive) → `transcribeAudio` → confirm sheet.
  - Paste → auto-titled textarea, tag chips input.
  - URL → single input + preview after scrape.
  - Upload → native file picker (mobile) or dropzone (desktop overlay, see below); shows per-file progress bars.
  - LinkedIn → toggle: Paste URL | Upload résumé. Both converge on the résumé-confirmation sheet.
- **`ResumeConfirmSheet`** — lists detected roles/skills/education from structured JSON; inline edit; Save writes `metadata.structured` and triggers embed.
- **`EntryFeed`** — vertical cards: source-type icon, title, tag chips, 2-line preview, pinned/archived state. Swipe gestures via `framer-motion` drag: left → archive, right → pin. Long-press or tap → **`EntryDetailSheet`** with full content, structured fields section, tags editor, and "Use in next generation" toggle (writes `use_in_next_gen`).
- **`IngestionStatusStrip`** — top thin strip subscribed to `knowledge_ingestion_jobs` realtime, shows "Parsing… Embedding… Ready" per active job.
- **`DesktopDropzone`** — full-viewport overlay on `window` dragenter (hidden on `useIsMobile`), accepted types + progress list.

All layout uses existing tokens (surface / border / accent amber). Tap targets ≥44px, no hamburger menus, verified against 375px viewport.

### 4. Ingestion job UX

Every capture creates a `knowledge_ingestion_jobs` row. Client subscribes via Supabase realtime channel scoped to `user_id`. Status strip updates live; on `error`, entry card shows retry button that re-invokes `ingestEntry`.

### 5. Acceptance validation

After build:
1. Upload résumé PDF via Playwright at 375×812 → confirm structured roles appear on entry within 15s.
2. Paste LinkedIn URL → confirm same structured shape.
3. Generate content with résumé entry pinned → assert output contains a role/company string present in the entry (spot-check via console log of retrieval hits).

### Technical notes

- **Embedding dims**: existing `knowledge_entries.embedding` is `vector(1536)`. Use `openai/text-embedding-3-small` (1536-dim) for both entries and chunks so a single index type works. Document this in `src/lib/knowledge/embedding.ts`.
- **File parsing** runs in server functions on Cloudflare Worker runtime — `pdfjs-dist` legacy build + `mammoth` browser build are Worker-safe; audio transcription reuses the existing Lovable AI gateway path.
- **Secrets to request when first used**: `LINKEDIN_SCRAPER_KEY` via `add_secret` (with README pointing at Proxycurl). No new keys needed for parse/transcribe/embed (Lovable AI Gateway).
- **No breaking changes** to `voice`, `brain`, or `orchestrator` — only additive: `buildGroundedPrompt` wraps existing `aiThink` calls, callers stay the same signature.
- **File layout**:
  ```text
  src/lib/knowledge/
    knowledge.functions.ts       # ingestEntry, searchKnowledge, list/pin/archive
    parsing.functions.ts         # parseDocument, scrapeUrl, scrapeLinkedIn
    extract.functions.ts         # extractResume
    embedding.ts                 # chunker + dim constant
    grounded-prompt.ts           # buildGroundedPrompt (client-safe)
    parsing.server.ts            # pdfjs/mammoth/readability helpers
  src/components/knowledge/
    ProfileSwitcherPill.tsx
    CaptureFab.tsx
    capture/{PasteSheet,UrlSheet,UploadSheet,LinkedInSheet,SpeakSheet}.tsx
    ResumeConfirmSheet.tsx
    EntryFeed.tsx
    EntryCard.tsx
    EntryDetailSheet.tsx
    IngestionStatusStrip.tsx
    DesktopDropzone.tsx
  src/routes/_authenticated/settings.knowledge.tsx  # rewritten
  ```
