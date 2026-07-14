# AI-first Milestones — end-to-end automation plan

## Goal
When a user picks a moment, Eve should behave like a 20-year veteran copywriter + personal-branding strategist: she already knows the user's voice, knowledge, and domain; she picks channels and per-channel framing; she drafts every piece, attaches an image, and books it into the same scheduling queue used for one-off drafts. The user reviews, doesn't assemble.

## What's missing today
1. No **Actor persona** — planner prompt is generic, not a veteran strategist tuned for personal-brand lift.
2. `voiceId` / `knowledgeProfileId` / `presetId` are accepted by `planWorkspaceArc` but never resolved or injected. MilestonePrepSheet doesn't pass them either.
3. Workspace items are **stubs** (`status: pending`, no `sections`). No copy is generated at milestone creation.
4. No **channel framing rules** — LinkedIn vs X vs blog vs email vs press differ in length, structure, hook, CTA; nothing enforces this.
5. **Images** aren't auto-assigned to workspace items even though drafts already support cover images.
6. **Scheduling** is split: `workspace_items.scheduled_date` never lands in `scheduled_content` (the real queue). `/queue` reads workspace_items only.
7. Existing draft workflow (`create_drafts` → schedule/publish/queue) is bypassed for milestone content.

## The new pipeline

```
Intake (intent + moment + optional date)
  │
  ▼
① Context resolver  (server)
    - active voice profile      (voice_profiles / settings)
    - active knowledge profile  (knowledge_profiles + top chunks via match_knowledge_chunks)
    - active domain + audience  (settings)
    - active preset (tone/style)
  │
  ▼
② Strategist interview  (Actor = "veteran copywriter + personal brand")
    - summary/goals/audience/proof/risks/POV/personal-brand angle
  │
  ▼
③ Arc + channel strategist  (same Actor)
    - phases, cadence, channel mix, ranked channels w/ role
    - per item: content_type, channels[], scheduled_offset, brief
  │
  ▼
④ Batch drafter  (per item, in parallel, capped)
    - resolves channel spec (word count, hook style, CTA, hashtag policy, tone)
    - uses voice + knowledge chunks + domain + preset
    - writes into `create_drafts.sections` and links workspace_item_id
    - status = 'ready' (not published)
  │
  ▼
⑤ Cover image assigner  (per item, best-effort)
    - picks style from image_generation_styles based on channel+phase
    - generates & attaches via existing draft-image flow
  │
  ▼
⑥ Schedule recommender → unified queue
    - for each item: writes to `scheduled_content` at recommended slot
    - workspace_item.release_status = 'scheduled' (or 'awaiting_approval' on T-day)
  │
  ▼
User reviews in Queue + Workspace detail (approve / tweak / reschedule / skip)
```

## Actor persona (new)
`src/lib/workspaces/actor.ts` — exports `MILESTONE_ACTOR_SYSTEM` = a compact system preamble prepended to interview, planner, and drafter prompts. Core: "You are a 20-year veteran copywriter and personal-brand strategist. Every piece must elevate the user's authority, differentiation, and audience trust. You know channel-native craft. You never produce generic corporate copy."

## Channel framing rules (new)
`src/lib/workspaces/channelSpecs.ts` — one record per Channel with: `max_chars`, `ideal_chars`, `structure` (hook/body/cta), `hashtag_policy`, `tone_hint`, `link_policy`, `format_map` (which CREATE_FORMATS render well here). Injected into the drafter prompt so the model writes native, not repurposed.

## Server changes (`src/lib/workspaces/workspaces.functions.ts` + new files)

1. **`resolveMilestoneContext(userId)`** — pulls active voice, active knowledge profile + top 6 chunks (RAG over intent), domain, audience, preset. Returns a compact `MilestoneContext`.
2. **`runWorkspaceInterview`** — inject Actor + context. Add fields: `pov`, `personal_brand_angle`, `differentiators`.
3. **`planWorkspaceArc`** — inject Actor + context; strategy now includes per-item `brief` used by drafter. Keep existing strategy schema.
4. **NEW `draftWorkspaceItem` (server fn)** — for one item: resolve channel spec → build system+prompt → call gateway → insert `create_drafts` row with `workspace_id`, `workspace_item_id`, `sections`, `status='ready'`, `platform=channels[0]`. Update `workspace_items.status='ready'`.
5. **NEW `autoAssignImage` (server fn)** — reuse existing `/api/drafts/generate-image` path; pick style by channel+phase; attach to draft.
6. **NEW `scheduleWorkspaceItem` (server fn)** — writes `scheduled_content` row + updates workspace_item; slot chosen from `scheduled_offset_days` clamped to user's send-window preference (default 9am local).
7. **`createWorkspace`** — after inserting stubs, kicks off a background orchestrator (`orchestrateWorkspace`) that walks items and calls steps 4→5→6 with concurrency 2 and per-item error capture; failures leave item in `status='failed'` with a reason.
8. **NEW `regenerateWorkspaceItem`** — user-triggered redo for a single item (copy or image).

## Client changes
- **`MilestonePrepSheet`**
  - After `Generate strategy`, show Actor + Context chips ("Voice: Jordan · Knowledge: Founder · Domain: fintech") so user sees what Eve is using.
  - Confirm button label → "Create & auto-draft".
  - On confirm, navigate to `/workspaces/$id` which now shows a live progress strip (X of N drafted · Y images · Z scheduled).
- **`workspaces.$id.tsx`**
  - Per-item row: shows draft status, channel chip, image thumb, scheduled slot, and inline actions: `Open draft`, `Regenerate copy`, `Regenerate image`, `Reschedule`, `Send to queue now`.
  - Poll every 3s while any item is generating.
- **`/queue`** — extend `listUpcomingReleases` to union `workspace_items` with their linked `scheduled_content` slot; single source of truth for "what's going out".
- **`BottomNav`** — no change; Queue already there.

## Data changes (migration)
- `workspace_items`: add `draft_id uuid` (FK create_drafts) + `image_asset_id uuid` (nullable) + `failure_reason text`.
- `create_drafts`: already has `workspace_id` / `workspace_item_id` — no change.
- `scheduled_content`: add `workspace_item_id uuid` (nullable, indexed) so the queue view can join.
- All new columns with grants preserved; no RLS surface change (parent policies already cover).

## Stress-test scenarios (must pass before ship)
1. **No target date** → items get relative offsets, `release_status='held_missing_day'`, no scheduled_content row until user sets slot.
2. **Missing voice/knowledge** → context resolver returns partial; Actor prompt still runs and surfaces a "Add voice for stronger personalization" hint on the workspace.
3. **Gateway 429 mid-batch** → orchestrator retries with jitter (max 2), remaining items stay `pending`; user sees "3 of 8 drafted, retrying".
4. **Item channel = X (280 chars)** — drafter output validated against `channelSpecs.max_chars`; over-length triggers one re-ask with a shorter budget, else clamp + mark `needs_review`.
5. **Duplicate slot collision** in `scheduled_content` → recommender bumps by +30 min until free within send-window; if window exhausted, holds and flags.
6. **User edits copy** in `create_drafts` → workspace item shows "edited by you" and skips regenerate-on-replan.
7. **Re-plan after some items released** → orchestrator skips items with `release_status='released'`; new items get appended, not renumbered.
8. **Image gen failure** → item still drafts + schedules; image slot shows placeholder + "Retry image".
9. **User deletes an item** → linked draft archived (not deleted), scheduled_content row cancelled.
10. **Mobile 390px** → progress strip, row actions, and queue rows all reachable without horizontal scroll.

## Files
**New:** `src/lib/workspaces/actor.ts`, `src/lib/workspaces/channelSpecs.ts`, `src/lib/workspaces/context.server.ts`, `src/lib/workspaces/orchestrator.server.ts`, `src/lib/workspaces/drafting.functions.ts`, migration.
**Edit:** `workspaces.functions.ts`, `queue.functions.ts`, `MilestonePrepSheet.tsx`, `workspaces.$id.tsx`, `queue.tsx`, `StrategyPanel.tsx` (add Actor + context chips).

## Model choice
Keep `claude-fable-5` via existing Anthropic orchestrator for strategy + drafting (already wired). Batch drafter runs with concurrency 2, per-item max 900 tokens.

## Out of scope (this pass)
Real channel publishing (LinkedIn/X APIs), analytics feedback loop, multi-user approval. All handled by the existing draft/queue surfaces once items are in `scheduled_content`.
