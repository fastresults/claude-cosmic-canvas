# Domain evidence capture — per-domain sub-library patterned after Curriculum Vitae

Today `/settings/domains` is just a flat list of chips (AI, Founder life, Product…). Each of those needs its own **evidence sub-library** — a scoped space where the user uploads and manages the supporting material that defines their point of view in that domain: white papers, research they've run, board memos, talks, articles, interviews, notes, links, voice memos.

Model each domain as a mini Curriculum Vitae. Same capture surfaces (paste / URL / upload / LinkedIn / voice), same entry list, same brain wiring — just scoped to that domain and rendered as a subsection under it.

## 1. Data model (one migration)

Add to `knowledge_entries`:

- `domain_id uuid null references public.domains(id) on delete set null`
- index `(user_id, domain_id)`

Entries with `domain_id = null` remain top-level Curriculum Vitae (unchanged).
Entries with `domain_id` set are that domain's sub-library.

No new tables — reuse `knowledge_entries`, `knowledge_chunks`, `knowledge_ingestion_jobs`. Uploads keep using the existing ingest pipeline (chunks, embeddings, jobs).

## 2. Server functions (`src/lib/knowledge/knowledge.functions.ts`)

- `ingestEntry`: accept optional `domain_id`; persist it on the row. After the insert, if `domain_id` is present, call `writeEdges` to upsert a `domain → knowledge` edge of kind `SOURCED_FROM` (edge kind already added with Presets).
- `listEntries`: accept optional `domain_id` filter. Omitted = all; explicit `null` = CV only; UUID = that domain only.
- `archiveEntry` / delete: also remove the paired brain edge for that entry.
- New `countEntriesByDomain()` server fn returning `{ domain_id, count }[]` so each domain row can show "3 sources" without over-fetching.

Grounded prompt reads (`match_knowledge_chunks`) already scope by profile; no signature change needed — a domain-scoped entry still belongs to a profile and remains retrievable.

## 3. UI — Domains settings (`src/routes/_authenticated/settings.domains.tsx`)

Keep the add form, "Your domains" list, suggestions, and Presets promo. Each domain row becomes expandable / tappable, revealing its evidence sub-library.

Row states:
- **Collapsed** (default): compass icon, name, "3 sources" pill, chevron, remove ×.
- **Expanded** (or opened as a full sheet on mobile — see §4): the sub-library.

Sub-library block per domain mirrors the CV page:

- Header row: domain name + short line "Evidence that grounds Eve when writing about {name}."
- `IngestionStatusStrip` scoped to entries for this domain.
- Entry list using `EntryCard` (reused), filtered by `domain_id = <this domain>`.
- Empty state: "No sources yet. Add a white paper, research doc, board memo, article, link, or voice memo."
- `CaptureFab` (reused) opens the five sheets (Paste, URL, Upload, LinkedIn, Speak), each pre-scoped to this domain.
- `EntryDetailSheet` (reused) for tapping into a source.

## 4. Mobile pattern — `DomainDetailSheet`

On mobile (default viewport), tapping a domain row opens a full-height `EveSheet` (`DomainDetailSheet`) containing the sub-library described above. This keeps the domains list scannable and gives each domain the same focused capture experience the CV page has. Desktop can inline-expand the same content under the row.

## 5. Capture sheet changes

The five capture sheets (`PasteSheet`, `UrlSheet`, `UploadSheet`, `LinkedInSheet`, `SpeakSheet`) take one new optional prop: `domainId?: string | null`. They forward it into `ingestEntry({ data: { ..., domain_id } })`. No visual change; the sheets already have the tag input, title, and body needed for white papers / research / memos.

CV page keeps calling them with `domainId={undefined}` — CV behavior unchanged.

## 6. Brain wiring

- `SOURCED_FROM` edge kind already exists (Presets migration).
- On ingest with `domain_id`: upsert `domain → knowledge` edge via `writeEdges`.
- On delete/archive: remove that edge.
- Domain and knowledge nodes are already rendered by `useBrainGraph`; the new edges appear in the Second Brain canvas automatically. Each domain node visibly branches into its evidence.

## 7. Out of scope for this pass

- Moving existing CV entries into a domain (add later as a menu on `EntryCard`).
- Multi-domain assignment per entry (single `domain_id` for now; migrate to a join table if the need appears).
- Per-domain search (BrainSearch already covers this globally).
- Preset ↔ domain pre-population.

## Build order

1. Migration: add `domain_id` + index on `knowledge_entries`.
2. Extend `ingestEntry` / `listEntries`; add `countEntriesByDomain`; wire `SOURCED_FROM` edge on save and removal.
3. Add optional `domainId` prop (pass-through) to the five capture sheets.
4. New `DomainDetailSheet` component that composes `IngestionStatusStrip` + entry list + `CaptureFab` + capture sheets + `EntryDetailSheet`, all scoped by `domainId`.
5. Update `settings.domains.tsx`: show source counts per row, make rows open the sheet, keep add/remove/suggestions/Presets promo intact.
