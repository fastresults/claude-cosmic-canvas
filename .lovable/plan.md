# Workspaces & Milestone Prep — Implementation Plan

Adds milestone-scoped **Workspaces** on top of the existing `/create` hub. Reuses tokens, `EveSheet`, `DraftCard`, `Pill`, `HoldToSpeakButton`, `ComposerBar`, `StreamCanvas`, `writeEdgeServer`, and the existing `[DOMAIN]→[VOICE]→[KNOWLEDGE]→[PRESET]→[FORMAT_RULES]→[TASK]` injection contract (extended with `[WORKSPACE_CONTEXT]`). No new visual styling. Stack-adapted: **TanStack `createServerFn`, not Supabase Edge Functions**; SSE streaming via `src/routes/api/create/*`.

## Phased build

### Phase 1 — Data model + isolation primitives
Single migration:
- `opportunity_workspaces`, `workspace_items` (per spec, with GRANTs + RLS `auth.uid() = user_id` scoped, EXISTS check on items).
- `ALTER TABLE create_drafts ADD COLUMN workspace_id uuid`, `workspace_item_id uuid`; indexed. (One drafts table today, not per-format — no fan-out.)
- Trigger: on `create_drafts.status = 'published'` where `workspace_item_id` present → bump `opportunity_workspaces.completed_items`. On workspace archive → cascade `archived = true` to linked drafts.
- `tg_set_updated_at` triggers on both new tables.

Client isolation layer:
- `src/lib/workspaces/workspaceContextStore.ts` — Zustand `{ workspaceId, workspaceItemId, setContext, clearContext }`.
- `src/hooks/useWorkspaceUrlContext.ts` — reads `?wsId`/`?wsItemId` on mount, clears on unmount, aggressively clears when URL has no `wsId`.
- Extend `create.$formatId.tsx` route search schema with `wsId?`, `wsItemId?`; every save/generate path spreads `{ workspace_id, workspace_item_id }` read fresh from store+URL.
- `listCreateDrafts` gains `excludeWorkspaceScoped: boolean` (default true for general hub); `restoreWorkspaceFromDraft(draft)` called inside draft loaders to rehydrate banner on deep-link.
- `Save` button label flips to "Save to Workspace" when `workspaceId` set.

### Phase 2 — Server functions (replace "edge functions" from spec)
All under `src/lib/workspaces/*.functions.ts`, `.middleware([requireSupabaseAuth])`, Lovable AI Gateway via existing `callAnthropic`/gateway helper. Model chosen from existing orchestrator config, not hardcoded.

- `planWorkspaceArc` — input `{ moment_type, target_date, intent, voiceId?, knowledgeProfileId?, presetId? }` → `{ ai_analysis, items[] }`. Phase heuristic: Tease T-14..T-4, Announce T-1..T+1, Amplify T+2..T+10, Sustain T+11..T+30. Picks `content_type` from `CREATE_FORMATS` registry.
- `runWorkspaceInterview` — voice/chat intake → initial `ai_analysis` (goals, audience, key messages, proof points, risks).
- `autoAnswerBrief` — pre-fills a format's brief from `ai_analysis` + Voice/Knowledge/Preset.
- `generateWorkspaceItem` — single-item generate; SSE streamed via `src/routes/api/workspaces/generate/$itemId.ts` (server route, bearer-authed, `text/event-stream`, `fallback: true` on error). Updates item `status` transitions.
- `autoGenerateWorkspace` — batch orchestrator over pending items; respects priority + simple concurrency cap.
- `curateWorkspace` — cohesion pass over all items → redundancy/tone/gap notes.
- `workspaceToBrain` — upserts `workspace` + `workspace_item` nodes into `brain_edges` (extend `NodeType` union with `workspace`, `workspace_item`; edges to `voice`, `knowledge`, `preset`, `campaign`, and `workspace_item → draft`). Ran on insert/update.
- `splitSequenceToDrafts` — shared util used by email-sequence / newsletter-sequence generators when `workspaceId` set: split into N `create_drafts` rows, one per `scheduled_date` (weekly cadence from parent), each carrying `workspace_id`, `workspace_item_id`, `distribution_channel`.

### Phase 3 — Injection contract extension
Extend `src/lib/create/create.functions.ts` prompt assembly to inject `[WORKSPACE_CONTEXT]` between `[PRESET]` and `[FORMAT_RULES]` when `workspace_id` present. Block includes milestone title, moment_type, T±n from target_date, arc phase, `ai_analysis.summary`, sibling item titles+phases (fetched in one query), and this piece's role. Logged in order so acceptance #6 is verifiable.

### Phase 4 — Mobile-first UI (reuses existing primitives)
- `src/routes/_authenticated/workspaces.tsx` (layout) + `workspaces.index.tsx` — vertical stream, each card uses existing card token; progress ring, moment_type chip (`Pill`), days-to-target, next scheduled item. FAB **New Milestone** opens `MilestonePrepSheet`.
- `src/components/workspaces/MilestonePrepSheet.tsx` — `EveSheet`, three steps: Intake (`HoldToSpeakButton` + text) → Preview arc (editable phased list) → Confirm.
- `src/routes/_authenticated/workspaces.$id.tsx` — phased timeline (Tease/Announce/Amplify/Sustain/Ongoing) using existing section pattern. Rows: status chip + scheduled date, tap → `/create/$formatId?wsId=…&wsItemId=…`. Long-press menu: reschedule / delete / duplicate.
- `src/components/workspaces/WorkspaceCalendarStrip.tsx` — horizontal date rail; drag to reschedule (touch-first).
- `src/components/workspaces/ActiveWorkspacePill.tsx` — mirrors `ActivePresetPill`; mounted in `ComposerBar` and `create.$formatId.tsx` header. Auto-hides when `workspaceId` null. Tap → workspace detail.
- Voice Orb intents wired in existing intent classifier: "prep a launch for March 12" → open sheet prefilled; "add teaser to this workspace" → append item, phase=tease; "reschedule by a week" → bulk shift; "what's next" → read next unscheduled.
- Home CTA row adds **Workspaces** entry beside Create.

### Phase 5 — Syndication + archive
- Syndication calendar gains a **workspace swimlane** grouped by `workspace_id`, color-coded via existing token palette by `moment_type`.
- Publish flow flips draft `status = 'published'`; trigger updates counter.
- Archive workspace → cascade archive to linked drafts; drafts remain readable under an "Orphaned" filter in the Drafts hub when workspace is deleted (drafts unlink but stay).

### Phase 6 — Acceptance verification
Scripted checks matching the 8 acceptance criteria: seed a voice-driven workspace, assert ≥6 items in <20s, SQL-verify `workspace_id` on saved drafts, verify general hub excludes them, verify sequence splitting, verify cascade + orphan filter, grep server logs for the contract order, snapshot the `ActiveWorkspacePill` presence.

## Technical notes (stack adaptations)

- **No Supabase Edge Functions** — spec's `workspace-*` edge functions become `createServerFn` in `src/lib/workspaces/*.functions.ts`. Streaming uses a TSS server route under `src/routes/api/workspaces/`.
- **Single `create_drafts` table** — spec says "add `workspace_id` to every `*_drafts` table"; this project has one table, so it's one ALTER.
- **Content generations** — this project stores generations inline on `create_drafts` (no separate `content_generations` table). `splitSequenceToDrafts` writes N `create_drafts` rows instead.
- **Workspace context store** reads from both Zustand and URL on every save to survive long-running async writes, per spec.
- **RLS on `workspace_items`** uses EXISTS against parent, not a denormalized `user_id`, to keep the ownership check single-source.

## Open questions

1. **Syndication swimlane** — does the existing syndication/calendar module already exist to hook into, or should Phase 5 stub the swimlane and defer publish-trigger wiring?
2. **Voice interview transport** — reuse `HoldToSpeakButton` + existing STT path, or dedicated `workspace-interview` streaming route?
3. **Orphaned drafts filter** — surface as a chip in Drafts hub, or a separate `/drafts/orphaned` route?
