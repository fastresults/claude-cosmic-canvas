# AI-First Milestone Workflow

Goal: when a user starts a Milestone, the system doesn't just collect selections — it produces a full strategic release plan (channels, frequency, mix, caps, schedule) and enforces day-of user approval before anything leaves the queue.

## 1. Planner output becomes a strategy, not a list

Extend `planWorkspaceArc` in `src/lib/workspaces/workspaces.functions.ts` so the model returns a `strategy` block alongside `items`:

```text
strategy: {
  thesis: string                    // 1-2 sentence "why this arc wins"
  target_outcomes: string[]         // press hits, signups, pipeline, etc.
  phases: {
    tease | announce | amplify | sustain: {
      window: { start_offset, end_offset }   // days from T
      cadence_per_week: number
      max_items: number
      channels: Channel[]                    // ranked, with rationale
      format_mix: { content_type, count, why }[]
      primary_message: string
    }
  }
  channel_strategy: {
    channel: Channel
    role: "anchor" | "amplifier" | "proof" | "community"
    audience_fit: string
    cap_per_week: number
  }[]
  risks: string[]
}
items: [ ...existing, plus channel, rationale, depends_on? ]
```

Prompt changes:
- Feed the interview's `audience`, `key_messages`, `proof_points` into the arc prompt (currently unused).
- Ask the model to pick channels per phase from a fixed enum (LinkedIn, X, blog, press release, email, podcast, YouTube, event, community) and justify each.
- Ask for cadence + max caps per phase, and format-mix rationale (why 2 tweets + 1 PR at announce, not 5 tweets).
- Keep `scheduled_offset_days` per item, but each item also inherits `phase.channels` unless the model overrides.

Structured output via AI SDK `Output.object` (no schema bounds — clamp in code). Use `google/gemini-3-flash-preview`.

## 2. New tables: strategy + approval queue

Migration:

```sql
-- Strategy snapshot per milestone (regenerated on re-plan)
create table public.workspace_strategy (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.opportunity_workspaces(id) on delete cascade,
  user_id uuid not null,
  thesis text,
  target_outcomes jsonb not null default '[]',
  phases jsonb not null default '{}',
  channel_strategy jsonb not null default '[]',
  risks jsonb not null default '[]',
  ai_model text,
  created_at timestamptz not null default now()
);

-- Per-item channel + queue state
alter table public.workspace_items
  add column channels text[] not null default '{}',
  add column release_status text not null default 'draft'
    check (release_status in ('draft','scheduled','awaiting_approval','held_missing_day','approved','released','skipped')),
  add column approved_at timestamptz,
  add column approved_by uuid,
  add column release_notes text;
```

Grants + RLS + `has_role` service policies per the public-schema rule.

## 3. Day-of approval queue

New route `src/routes/_authenticated/queue.tsx` — the release cockpit:

- Sections: **Today needs approval**, **Missing schedule (held)**, **Upcoming 7 days**, **Released**.
- Each row: milestone chip, phase chip, channel chips, scheduled time, "Approve & release" / "Reschedule" / "Skip" / "Edit".
- Approve → sets `release_status='approved'`, `approved_at=now()`, `approved_by=userId`; server fn `releaseWorkspaceItem` writes to channel adapters (stub for now, real adapters later) then flips to `'released'`.
- Missing day rule: cron/serverFn `reconcileQueue` runs at load and on any workspace mutation — items where `scheduled_date is null` OR `scheduled_date < today AND status != released` flip to `held_missing_day` and stay in the queue until the user reschedules or skips.
- Nothing auto-publishes. Day-of approval is required for every item, matching the rest of the scheduling system.

## 4. Milestone UI: show the strategy

`MilestonePrepSheet` preview step (`src/components/workspaces/MilestonePrepSheet.tsx`):
- Add a **Strategy** panel above the item list: thesis, per-phase cards (cadence, max, channels, mix), channel role table, risks.
- User can accept, tweak cadence/channels per phase (writes back into strategy JSON), or "Regenerate strategy" (re-runs planner with a nudge prompt).
- Item list groups by phase, shows channel chips per item, editable.

Workspace detail (`src/routes/_authenticated/workspaces.$id.tsx`):
- New "Strategy" tab that renders the same panel read-only.
- "Send to queue" button on each item: sets `release_status='scheduled'` (or `held_missing_day` if no date).

## 5. Bottom nav / entry point

Add "Queue" item to `src/components/shell/BottomNav.tsx` with a badge count of items needing approval today.

## 6. Stress test — walked through the workflow

Scenarios the plan must survive:

1. **Keynote, 3 weeks out, no target date given.** Interview must ask/assume date; planner without date should still produce phases as relative offsets and mark the milestone `target_date_pending`. Queue: everything sits as `held_missing_day` until user sets the date. ✅ handled by held state.
2. **User removes 3 items from the arc.** Strategy caps say announce = max 4, mix = 2 posts + 1 PR + 1 email. Deleting items must not silently violate caps — show "below target cadence" hint, offer "Fill gap with AI".
3. **User changes channels on 1 item.** Item override wins; channel_strategy weekly cap recomputes; if cap exceeded, warn.
4. **T-day arrives, user hasn't approved.** Item stays in queue, does NOT auto-release. Notification fires at 8am local (existing `notifications` table).
5. **Re-plan mid-arc.** Regenerating strategy must preserve already-released items (immutable) and only replan future items.
6. **Two milestones overlap on same day/channel.** `reconcileQueue` surfaces a "channel collision" chip; user resolves manually.
7. **Model returns malformed strategy.** `Output.object` may fail — wrap with `NoObjectGeneratedError` fallback, parse `error.text`, and if still bad, save items only and mark `strategy = null` with a "Generate strategy" retry button.
8. **Anon SSR.** All new server fns use `requireSupabaseAuth`; never called from public loaders.
9. **Long arcs (30+ items).** Cap planner at 20 items per generation, paginate sustain phase into a second call if needed.
10. **User on mobile approves in queue.** Row = single-tap approve, swipe to reschedule/skip; matches EveSheet + mobile-first system.

## Technical notes

- Files to add: migration, `src/lib/workspaces/queue.functions.ts`, `src/lib/workspaces/strategy.ts` (types), `src/routes/_authenticated/queue.tsx`, `src/components/workspaces/StrategyPanel.tsx`, `src/components/workspaces/QueueRow.tsx`, `src/hooks/useReleaseQueue.ts`.
- Files to edit: `workspaces.functions.ts` (planner + new `releaseWorkspaceItem`, `reconcileQueue`, `regenerateStrategy`), `MilestonePrepSheet.tsx`, `workspaces.$id.tsx`, `BottomNav.tsx`, `routeTree.gen.ts` (auto).
- Model: `google/gemini-3-flash-preview` via existing orchestrator/gateway. Structured output with schema-lite + code clamps.
- Channel adapters: stubbed `releaseToChannel(channel, item)` returning `{ ok, url? }`; real integrations are out of scope for this plan.

## Out of scope

- Real channel publishing integrations (LinkedIn/X/email APIs).
- Cross-milestone budget optimizer.
- Auto-approval / auto-release rules.
- Analytics loop from released → performance.
