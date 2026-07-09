# Eve OS — Full Build Plan (7 Phases)

Foundation (M0 + M1.5 + Brain scaffold) is already shipped: schema, auth, app shell, 5-tab nav, `<Orb>`/`<EveSheet>`/`<DraftCard>`, Brain canvas + realtime + `writeEdge`. The remaining work breaks into **7 phases**.

## Phase 1 — Orchestrator + AI Plumbing
- Wire hybrid model layer: Claude Fable 5 (thinking) via existing orchestrator; Lovable AI Gateway for STT, image gen, embeddings.
- `src/lib/ai/` clients: `claude.ts`, `gateway.ts`, `embeddings.ts`, `stt.ts`, `image.ts`.
- Server fns: `ai.transcribe`, `ai.embed`, `ai.image`.
- Provenance helper: every AI call auto-writes a `brain_edges` row (source, prompt hash, model, tokens).

## Phase 2 — Onboarding + Voice Profile
- `/onboarding` flow: identity → domains → tone samples → goals.
- Hold-to-speak capture → STT → Claude extracts `voice_profile` (tone axes, forbidden phrases, signature moves).
- Persist to `personas` + `voice_profiles`; seed initial `brain_edges` (You → Persona → Domain → Voice).
- First Brain "bloom" animation on completion.

## Phase 3 — Content Drafting (Home)
- `ComposerBar` → `content.draft` serverFn → Claude with persona + voice + retrieved knowledge (pgvector).
- `<DraftCard>` state machine: idea → draft → revise → approved.
- Rewrite/tone actions (shorter, punchier, on-brand) via Claude.
- Every draft writes edges: Prompt → Draft → Sources → Persona.
- Library tab: filter/search drafts, campaigns, arcs.

## Phase 4 — Second Brain (Full)
- Node types: Persona, Domain, Knowledge, Entity, Draft, Campaign, Arc, Source.
- View modes: Map, Timeline, Clusters.
- Node inspector sheet (provenance, related, actions).
- Search + semantic query (`brain.query` serverFn, pgvector).
- Manual knowledge ingest (paste/upload → chunk → embed → nodes).

## Phase 5 — Arcs + Campaigns + Scheduling
- Arcs tab: multi-step narrative planner (Claude generates arc_nodes).
- Campaigns: group drafts, assign channels, schedule.
- `schedules` + pg_cron worker (`/api/public/process-social-queue`) with HMAC.
- Notifications center (in-app + optional email).

## Phase 6 — Channel Connections (M2)
- `channel_connections` OAuth flows: X, LinkedIn, Instagram, Threads, YouTube, TikTok, Substack.
- Publish adapters per channel; retry + status on `DraftCard`.
- OAuth callback routes under `/api/public/oauth/*` (signature-verified).
- MCP client registry (`mcp_clients`) for external tool access via `@lovable.dev/mcp-js`.

## Phase 7 — Polish, PWA, GA
- PWA manifest, offline shell, install prompt, push (optional).
- Settings: personas manager, voice tuning, data export, danger zone.
- Accessibility pass (reduced motion, focus, contrast), perf budget, empty/error states.
- Analytics + audit_log surfacing, admin role via `has_role`.
- SEO metadata per route, social OG images, published launch.

## Technical Notes
- All AI calls server-side; keys never touch client.
- Every mutation that changes user knowledge writes to `brain_edges` for zero-fabrication guarantee.
- Semantic tokens only; dark-first; Instrument Serif + Inter Tight throughout.
- `createServerFn` for internal; Edge/`/api/public/*` only for webhooks + cron.
- RLS + GRANTs on every new public table in the same migration.

## Proceeding
On approval I'll start **Phase 1** immediately: AI client modules, three server fns, provenance helper, and a smoke test writing a Claude-sourced edge into the Brain.