
# Presets — Settings + Second Brain wiring

Adapts the PRD to this project's stack: **TanStack `createServerFn`** (not Supabase Edge Functions), the existing **`brain_edges`** graph (not a parallel `second_brain_*` schema), and the existing Lovable AI Gateway. Mounted as a new Settings entry sitting directly beneath **Domains** in the Settings index, since Presets compose Domains + Voice + Knowledge + Audience.

## 1. Placement in Settings

`src/routes/_authenticated/settings.index.tsx` — insert a new row after **Domains**:
- `{ to: "/settings/presets", icon: Layers, label: "Presets", hint: "Reusable content lenses (voice + domains + audience + refs)" }`

New routes:
- `/settings/presets` — list
- `/settings/presets/$id` — detail (edit-in-place sheet host)

## 2. Database (one migration)

New tables in `public` (RLS `user_id = auth.uid()`, GRANTs to `authenticated` + `service_role`, `updated_at` trigger via existing `tg_set_updated_at`).

- `presets` — `id, user_id, name, description, brief_config jsonb, selected_domain_ids uuid[], selected_audiences text[], factor_weights jsonb, research_context jsonb, is_default bool, is_favorite bool, use_count int, last_used_at timestamptz, created_at, updated_at`. Partial unique index `(user_id) WHERE is_default`.
- `preset_documents` — `id, preset_id, user_id, source_type text CHECK IN ('url','file','paste','linkedin','resume','voice'), source_url, file_name, file_type, file_size, extracted_text, structured jsonb, priority text CHECK IN ('low','normal','high') DEFAULT 'normal', saved_at`.
- `preset_usage` — `id, preset_id, user_id, used_at, surface text`.
- `audiences` — `id, user_id, name` (mirrors `domains`; needed so audiences can become brain nodes with stable ids).

Reuse `brain_edges` for the graph. Extend `NodeType` in `src/lib/brain/edges.ts` with `"preset"`, `"audience"`, `"document"` and add `EdgeKind`s `"REFERENCES_DOC"`, `"USES_VOICE"`, `"TARGETS_AUDIENCE"`, `"SCOPES_DOMAIN"`. (`AUTHORED_BY`, `SPEAKS_IN`, `EXPERT_IN`, `SOURCED_FROM` already exist and are reused where they fit.) Extend `TYPE_PRETTY` and `fetchLabel` in `useBrainGraph.ts` for the three new node types so orbs render with real names.

No `second_brain_nodes` / `second_brain_edges` / vector table — the brain view already resolves labels on demand from source tables, and semantic recall goes through the existing `knowledge_chunks` + `match_knowledge_chunks` RPC.

## 3. Server functions — `src/lib/presets/presets.functions.ts`

All `.middleware([requireSupabaseAuth])`, Zod-validated:

- `listPresets`, `getPreset`, `createPreset`, `updatePreset`, `deletePreset`, `favoritePreset`, `setDefaultPreset`, `recordPresetUsage`.
- `buildPresetFromSeed({ seed, urls?, files? })` — non-streaming for v1. Calls Lovable AI Gateway (`openai/gpt-5.5`, structured output) to produce `{ name, description, brief_config, suggested_domains[], suggested_audiences[], research_context }`. Attachments are stored as `preset_documents` (files via base64 like existing `parsing.functions.ts`; LinkedIn URL detection triggers `scrapeLinkedIn`; résumé detection via `detectDocKind` triggers `extractResume`).
- `extractResume`, `scrapeLinkedInProfile` — thin wrappers reusing `parsing.server.ts` + a gateway call returning `{ full_name, headline, about, roles[], education[], skills[], achievements[] }` into `preset_documents.structured`.
- `applyPreset({ preset_id, task })` — hydrates `[DOMAIN]/[VOICE]/[KNOWLEDGE]/[PRESET]/[TASK]` using existing `buildGroundedPrompt`, calls `match_knowledge_chunks` for top-K (filtered by any preset-linked knowledge entry ids first, then general), increments `use_count`, writes `preset_usage`, returns the built prompt (generation call sites hook this in later).
- `syncPresetToBrain(preset_id)` — called from `createPreset`/`updatePreset`. Uses `writeEdges`:
  - `you --EXPERT_IN--> preset`
  - `preset --SCOPES_DOMAIN--> domain` (per selected domain)
  - `preset --TARGETS_AUDIENCE--> audience`
  - `preset --USES_VOICE--> persona` (active persona)
  - `preset --REFERENCES_DOC--> document` (per `preset_documents`, weight in `meta`)
  - `preset --SOURCED_FROM--> knowledge` (when a document row also lives in `knowledge_entries`)
  Idempotency: delete existing outgoing edges for the preset first, then reinsert.
- `deletePreset` cascades preset rows; brain edges owned by the preset are removed, target nodes untouched.

No new edge functions; all logic lives in server functions per project convention.

## 4. Frontend

Reuse existing primitives (`EveSheet`, `Pill`, `SettingsPageHeader`, `CaptureFab`, `Button`, etc.). Mobile-first, one-thumb at 375px, host tokens only.

New files:
- `src/hooks/usePresets.ts` — react-query CRUD, favorite, set-default, invalidation.
- `src/hooks/useActivePreset.ts` — resolves `?preset=` override, else `is_default`.
- `src/routes/_authenticated/settings.presets.tsx` — hosts `PresetsList`.
- `src/routes/_authenticated/settings.presets.$id.tsx` — hosts `PresetDetailSheet` as a route-owned sheet.
- `src/components/presets/PresetsList.tsx` — search, filter chips (All/Favorites/Most Used/Recent), FAB "New Preset", swipe-left archive, swipe-right pin, long-press multi-select.
- `src/components/presets/CreatePresetSheet.tsx` — seed textarea + attach menu (Paste/URL/Upload/LinkedIn/Voice memo), calls `buildPresetFromSeed`, shows live preview, saves.
- `src/components/presets/PresetDetailSheet.tsx` — sections Brief · Domains · Audiences · Documents · Research · Weights · Brain Links, edit-in-place.
- `src/components/presets/PresetInBrainView.tsx` — list of outgoing edges, tap opens `EveSheet` for the linked node (reuses existing peek path).
- `src/components/presets/ActivePresetPill.tsx` — mounted in `ComposerBar` next to voice/knowledge pills. Tap opens `PresetPickerSheet`.
- `src/components/presets/PresetPickerSheet.tsx` — pinned + recent, "Clear", "Set default", "N fields changed since last use" banner (diff against `last_used_snapshot` stored in `brief_config`).
- Add "+ Attach preset" affordance on the **Domains** settings page pointing to `/settings/presets` (this is the "under Domains" surfacing).

## 5. Injection contract

Add `src/lib/presets/injection.ts`:
```
[DOMAIN] → selected domains joined
[VOICE]  → active persona sliders + directives
[KNOWLEDGE] → top-K chunks (preset-scoped first)
[PRESET] → brief_config + audiences + factor_weights
[TASK]   → user request
```
System sentence appended verbatim per PRD §7. Wired through `applyPreset`; generator entrypoints (`orchestrate.functions.ts`, `content.functions.ts`) call it when an active preset exists.

## 6. Realtime

`usePresets` subscribes to `postgres_changes` on `presets` filtered by `user_id` for instant cross-tab pill updates (mirrors `useBrainGraph` pattern).

## 7. Out of scope for v1

- Streaming progress from `buildPresetFromSeed` (return-once for v1; add SSE later).
- Vector embeddings on preset nodes (recall uses existing `knowledge_chunks`).
- Graph-mode brain view for preset edges (list view only in `PresetInBrainView`).

## Build order

1. Migration (tables + audiences + GRANTs + RLS + trigger + brain_edges enum extensions if needed — currently `src_type`/`dst_type` are plain text, so no enum change).
2. Extend `src/lib/brain/edges.ts` + `useBrainGraph.ts` label resolver.
3. `presets.functions.ts` (CRUD + `syncPresetToBrain`) + `injection.ts`.
4. Hooks + routes + `PresetsList` + `CreatePresetSheet` + `PresetDetailSheet` + `PresetInBrainView`.
5. `ActivePresetPill` + `PresetPickerSheet`, mount in `ComposerBar`.
6. `buildPresetFromSeed`, `extractResume`, `scrapeLinkedInProfile`.
7. Wire `applyPreset` into existing generator entrypoints.
8. Realtime subscription.

## Acceptance

Matches PRD §9, adapted: preset shows up as a `preset` orb in the Brain with edges to its documents/domains/audiences/voice; default preset auto-hydrates next compose; deleting a preset removes only its own edges.
