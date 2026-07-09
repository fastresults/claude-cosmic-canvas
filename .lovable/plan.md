
# Eve OS — Kickoff Plan (M0 + M1.5 + Brain scaffold)

Committing to my recommended defaults so we can build. Scoping to the first shippable slice; the rest of PRD §26 lands in follow-up turns.

## Decisions (my picks — override anytime)

1. **Hybrid orchestration.** Claude Fable 5 (via the Anthropic client we already wired) handles the *thinking*: planning, drafting, tone/rewrite, campaign arcs, brain provenance reasoning. Lovable AI Gateway handles everything Anthropic can't do natively: **STT** (`openai/gpt-4o-mini-transcribe`), **image generation** (`google/gemini-3.1-flash-image` default, `openai/gpt-image-2` for text-in-image), **embeddings** for knowledge search. This gets Claude's reasoning quality on the critical path without giving up cheap fast multimodal.
2. **`createServerFn` for app-internal.** All app calls (`content.draft`, `brain.query`, etc.) are TanStack server functions — faster, typed, easier to iterate. Edge Functions reserved for `process-social-queue` (pg_cron target) and OAuth webhooks (M2).
3. **Progressive dark theme.** Dark-first only in v1; no light-mode toggle. Simplifies token surface.

## Step 1 — Enable Lovable Cloud
Provisions Supabase (Postgres + RLS + Storage + Auth + Realtime + pg_cron), the managed `_authenticated/` gate, and generated client. Required for §16 schema.

## Step 2 — Design system (PRD §17)
- Rewrite `src/styles.css` with Eve OS OKLCH tokens: `--background` (#08060f), `--surface` (#1a1428), `--accent` (amber #f5c14a), `--accent-2` (violet #8b5cf6), `--brain-teal`, `--brain-rose`, `--brain-blue`, semantic mappings for card/popover/muted/border.
- `bun add @fontsource/instrument-serif @fontsource/inter-tight` and import in `src/main.tsx`; wire `--font-display` / `--font-body` in `@theme inline`.
- Radii sm/md/lg/pill; motion timing tokens.
- Update `__root.tsx` head: title "Eve OS — Speak once. Publish everywhere.", description, OG tags, twitter card.

## Step 3 — Database schema (single migration, PRD §16)
Every table with RLS + explicit GRANTs for `authenticated` and `service_role` in the same migration:
`profiles`, `personas`, `voice_profiles`, `domains` (2-word CHECK constraint), `knowledge_entries`, `entities`, `drafts`, `campaigns`, `arc_nodes`, `schedules`, `channel_connections` (oauth tokens encrypted), `mcp_clients`, `notifications`, `audit_log`, `user_roles` (`app_role` enum: admin/super_admin/tester/user) + `has_role()` SECURITY DEFINER, **`brain_edges`** with `(user_id, src_id)` and `(user_id, dst_id)` indexes.
Extensions: `pgvector`, `pg_trgm`, `pg_cron`, `pg_net`. Auto-create-profile trigger on signup.

## Step 4 — Auth (PRD §26 step 3)
Email/password + Google via `supabase--configure_social_auth`. Routes: `/auth` (unified sign-in/sign-up), `/forgot-password`, `/reset-password`. Managed `_authenticated/route.tsx` layout protects everything else.

## Step 5 — App shell (M1.5, PRD §4)
- `src/components/shell/AppShell.tsx` — TopBar (avatar · streak · bell) + `<Outlet />` + `ComposerBar` + `BottomNav`.
- `BottomNav` — 5 tabs: Home (`/`), Library (`/library`), Arcs (`/arcs`), **Brain (`/brain`)**, Settings (`/settings`), plus `⚙`.
- `ComposerBar` — always-visible input + `<HoldToSpeakButton>` (state machine only; STT wiring is M1).
- Shell mounts inside `_authenticated/route.tsx` so every protected route inherits it.

## Step 6 — Core primitives (M1.5)
- `<Orb>` — Framer Motion turbulence idle loop (6s, 30% breathing); amber halo listen state driven by Web Audio amplitude (stubbed constant for now).
- `<EveSheet>` — single bottom-sheet primitive (Vaul, iOS rubber-band 250ms). Used everywhere; no ad-hoc modals.
- `<DraftCard>` — full state machine (idle/streaming/done/error); header · body preview · toolbar (Regen/Tighten/Tone/Fit-to) · score · sources chip. Real data wires in M1.
- `<Pill>`, `<HoldToSpeakButton>` (with `setPointerCapture`).

## Step 7 — Empty Brain tab wired to realtime (M4.5 scaffold)
- `/brain` route with React Flow canvas; custom frosted-glass node components using tokens; single **You** ✦ node at origin.
- Supabase Realtime channel `brain:{user_id}` subscribed; upserts to `brain_edges` push into local React Flow state.
- Peek Sheet stub opens on node tap. View switcher shell for Constellation / Timeline / Radial / List / Health (only Constellation renders in v0).
- `src/lib/brain/edges.ts` — typed `writeEdge()` helper every future generation calls (`AUTHORED_BY`, `SOURCED_FROM`, etc.).
- Brain intro animation: amber point → radial burst → settle (900ms, honors `prefers-reduced-motion`).

## Step 8 — Home (Orb canvas)
Replace the smoke-test index with the real Eve OS home: centered `<Orb>`, "Try asking" pills, ComposerBar. No generation yet — orb press just cycles state machine + haptic feedback.

## Package installs
`react-flow` (@xyflow/react), `framer-motion`, `vaul`, `d3-force`, `@fontsource/instrument-serif`, `@fontsource/inter-tight`. Supabase client comes with Lovable Cloud.

## What lands in later turns (not this one)
M1 `content.draft` (Claude Fable 5) · STT · image gen · M2 channels/scheduling · M3 MCP server · M4 ArcMap · M4.5 full Brain (Timeline/Radial/List/Health/search/prune) · M5 intelligence · admin surface · notifications · PWA · analytics.

## Non-negotiables enforced
- Semantic tokens only, never hardcoded colors.
- RLS + GRANTs on every public-schema table in the same migration.
- Roles in `user_roles`, never on `profiles`.
- Zero fabrication: every generation writes brain edges recording sources.
- `LOVABLE_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-only.

Approve and I'll build.
