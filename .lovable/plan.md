
# Claude Fable 5 as scaffolded app orchestrator

## Goal

Promote the existing `src/lib/orchestrator/` from a single-shot Anthropic call into a **tool-using agent** powered by `claude-fable-5` through the Lovable AI Gateway. The agent becomes the brain behind every AI-heavy surface (Create, Milestones, Brain, Knowledge) and a new global **Eve Copilot** attached to the ComposerBar — one loop, many tools, one voice-gated identity.

## Why this fits what's already built

- `src/lib/orchestrator/config.ts` already pins `ORCHESTRATOR_MODEL = "claude-fable-5"`.
- `orchestrate.functions.ts` already resolves the active voice, loads directives, composes a style block, and blocks generation when no voice exists (`needsVoice: true`). That gate stays — it becomes the agent's system-prompt preamble.
- `MILESTONE_ACTOR_SYSTEM` (Eve persona) and `resolveMilestoneContext` (voice + knowledge + domain + audience) are exactly the context the orchestrator should inject on every call.
- The app already has server functions for Create drafting, channel rules, image generation, drafts, brain search, knowledge ingest, workspaces/milestones — perfect tool candidates.

## Architecture

```text
                ┌───────────────────────────────┐
   Client UI ─▶ │  /api/orchestrator/chat       │  (TanStack server route, streaming)
   (Eve         │  streamText + tools + Fable 5 │
    Copilot,    └──────────────┬────────────────┘
    Create,                    │
    Milestone,                 ▼
    Brain)          ┌──────────────────────┐
                    │  Orchestrator Core   │
                    │  - Actor system      │
                    │  - Voice gate        │
                    │  - Context resolver  │
                    │  - Tool registry     │
                    └──────────┬───────────┘
                               │ tool calls
              ┌────────────────┼────────────────────┐
              ▼                ▼                    ▼
        Create tools     Brain tools         Knowledge/Workspace tools
        (draft, channel  (search, expand,    (ingest, milestone.plan,
         adapt, image)    provenance)         milestone.draft_item)
```

Every tool is a thin wrapper over an **existing** server function — no business logic moves into the orchestrator.

## Steps

### 1. Provider + runtime swap (foundation)
- Add `src/lib/orchestrator/gateway.server.ts` reusing the pattern already in `src/lib/ai/gateway.server.ts` (`createLovableAiGatewayProvider`) so the orchestrator goes through Lovable AI Gateway instead of `api.anthropic.com`.
- Replace `callAnthropic` internals in `anthropic.server.ts` with AI SDK `streamText` / `generateText` bound to `gateway("anthropic/claude-fable-5")` (verify exact gateway id; fall back to configured model string).
- Keep `ORCHESTRATOR_MODEL` and `MAX_TOKENS` in `config.ts` as single source of truth; add `REASONING_EFFORT` and `TOOL_STEP_LIMIT = stepCountIs(50)`.
- Retire `ANTHROPIC_API_KEY` dependency (LOVABLE_API_KEY only).

### 2. Actor + context composition
- New `src/lib/orchestrator/system.server.ts` that composes, in order:
  1. `MILESTONE_ACTOR_SYSTEM` (Eve persona).
  2. Voice style block from `formatStyleContext(voice, directives)` (existing).
  3. `contextBlock(ctx)` from `resolveMilestoneContext` (user, domain, audience, knowledge snippets).
  4. Surface-specific instructions (Create vs Milestone vs Copilot) passed by the caller.
- The voice gate stays: if no voice → return `{ needsVoice: true }` before any model call.

### 3. Tool registry
Create `src/lib/orchestrator/tools/` — one file per tool, each exporting an AI SDK `tool({ description, inputSchema, execute })` that calls an existing server function. Initial set:

| Tool | Wraps | Purpose |
|---|---|---|
| `create.draft_for_format` | `create.functions.ts` | Draft content for one format |
| `create.adapt_for_channel` | `channel-rules.ts` + drafts fn | Rewrite a draft per channel (X/LinkedIn/IG) |
| `create.generate_image` | `aiImage` in `ai.functions.ts` | Cover/companion image |
| `brain.search` | brain/knowledge search fn | Semantic recall over user's Brain |
| `brain.expand_node` | brain edges fn | Traverse provenance |
| `knowledge.ingest_url` | `knowledge.functions.ts` | Add a URL to the active knowledge profile |
| `milestone.plan` | `workspaces/pipeline.functions.ts` | Phase/channel plan for a milestone |
| `milestone.draft_item` | pipeline drafter | Draft one queue item |
| `drafts.schedule` | `drafts.functions.ts` | Move a draft into the queue |
| `nav.go` | client callback | Navigate the app (Copilot only) |

Rules:
- Every tool that mutates or spends credits sets `needsApproval` where user-visible.
- Tools receive `context.supabase` + `context.userId` from `requireSupabaseAuth`; no service-role.
- Tool result shapes are compact JSON — never raw HTML/base64 back to the model.

### 4. Streaming route (Copilot backbone)
- New `src/routes/api/orchestrator/chat.ts` (TanStack server route) using `streamText` + tool registry + `stopWhen: stepCountIs(50)`, gated by `requireSupabaseAuth`-equivalent bearer check.
- Response via `toUIMessageStreamResponse({ originalMessages, onFinish })`.
- `onFinish` persists messages to a new `orchestrator_threads` / `orchestrator_messages` table (see §6).

### 5. Non-streaming orchestrate (existing callers)
- Keep `orchestrate` server fn API-compatible for current callers, but internally delegate to the same core (`generateText` variant, no tools by default, `surface: "generic"`).
- Add `orchestrateWithTools` variant for Milestone pipeline steps that need tool use without streaming.

### 6. Global Eve Copilot surface
- Wire ComposerBar (respecting the existing `useHasScopedMic()` rule) to open a copilot sheet that renders the streaming chat.
- Client uses `useChat({ id: threadId, transport: DefaultChatTransport({ api: "/api/orchestrator/chat" }) })`.
- Render `message.parts` including tool calls/results via existing `Markdown.tsx` and small tool-activity chips.
- Threaded storage in DB (per chat-agent-ui-contract): tables `orchestrator_threads(id, user_id, title, updated_at)` and `orchestrator_messages(id uuid, thread_id, role, parts jsonb, created_at)` with RLS scoped to `auth.uid()` and required GRANTs.
- New route `src/routes/_authenticated/copilot.$threadId.tsx` for shareable thread URLs; ComposerBar opens the most recent or creates one.

### 7. Surface integrations (reuse the core)
- **Create** (`create.$formatId.tsx`): the "Generate" action becomes `orchestrateWithTools({ surface: "create", formatId, channelId })`. The agent decides whether to call `create.draft_for_format`, `create.adapt_for_channel`, `create.generate_image`.
- **Milestones**: `useMilestoneAutoDraft` calls `orchestrateWithTools({ surface: "milestone", milestoneId })` — Fable 5 plans phases, then loops `milestone.draft_item` per queue row.
- **Brain**: `AskEveBar` posts to the streaming route with `surface: "brain"` — the agent uses `brain.search` + `brain.expand_node` before answering.
- **Knowledge**: `SpeakSheet` / `PasteSheet` post transcripts to orchestrator with `surface: "knowledge"` and let the agent decide ingest path.

### 8. Provenance & audit
- Every tool call records a Brain provenance edge via existing `recordGeneration` (already used in `aiThink`/`aiImage`).
- Every orchestrator run writes an `audit_log` row (`generation.orchestrated`) with `{ surface, thread_id, tool_calls: [...], voice_id }`.

### 9. Safety rails
- `TOOL_STEP_LIMIT = stepCountIs(50)`; per-tool timeouts inside `execute`.
- Cost cap: short-circuit the loop when cumulative usage exceeds a per-thread budget (config).
- No tool can escalate to `supabaseAdmin`; all data access flows through `context.supabase` under RLS.

### 10. Rollout
1. Ship §1 + §2 behind current `orchestrate` — no behavior change, just gateway swap. Validate with an existing Milestone run.
2. Add §3 registry + §5 `orchestrateWithTools`, migrate Milestone pipeline first (highest leverage, already tool-shaped).
3. Ship §4 + §6 Copilot as an opt-in surface on Home.
4. Migrate Create and Brain surfaces (§7).
5. Deprecate direct `callAnthropic` usage; delete `ANTHROPIC_API_KEY` from secrets.

## Files created

- `src/lib/orchestrator/gateway.server.ts`
- `src/lib/orchestrator/system.server.ts`
- `src/lib/orchestrator/tools/index.ts` + one file per tool listed in §3
- `src/lib/orchestrator/orchestrateWithTools.functions.ts`
- `src/routes/api/orchestrator/chat.ts`
- `src/routes/_authenticated/copilot.$threadId.tsx`
- `src/components/copilot/CopilotSheet.tsx`, `ToolActivityChip.tsx`
- `supabase/migrations/<ts>_orchestrator_threads.sql` (tables + RLS + GRANTs)

## Files edited

- `src/lib/orchestrator/anthropic.server.ts` → gateway-backed
- `src/lib/orchestrator/config.ts` → add step limit / reasoning effort
- `src/lib/orchestrator/orchestrate.functions.ts` → delegate to shared core
- `src/components/shell/ComposerBar.tsx` → open Copilot sheet
- `src/hooks/useMilestoneAutoDraft.ts` → call `orchestrateWithTools`
- `src/routes/_authenticated/create.$formatId.tsx` → route Generate through orchestrator
- `src/components/brain/views/AskEveBar.tsx` → stream via `/api/orchestrator/chat`

## Open questions to resolve during build

- Exact gateway model id for Claude Fable 5 (`anthropic/claude-fable-5` vs a Lovable-mapped alias) — verify via a probe call before wiring surfaces.
- Whether to persist tool-call parts or only text parts in `orchestrator_messages` (recommend: full `parts` JSON for replay fidelity).

## Verification

- Milestone run end-to-end: plan → draft 3 items → all rows show `generation.orchestrated` audit + provenance edges.
- Copilot: create thread, ask "draft a LinkedIn post about X", confirm tool calls (`create.draft_for_format` → `create.adapt_for_channel: linkedin`), reload thread URL restores messages.
- Voice gate: with no voice, every surface returns `needsVoice: true` — no silent fallback.
- `tsgo` + Playwright screenshot of Copilot sheet.
