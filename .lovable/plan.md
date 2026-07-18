# Production Readiness Plan — AskEve

Goal: take the app from feature-complete beta to a hardened, launchable product. Triage by **user-visible risk** first (crashes, data loss, security), then **trust** (perf, correctness), then **polish** (aesthetics, delight).

## Guiding principles

- **Ship-blockers before nice-to-haves.** A single unhandled crash or leaked service key outweighs 20 UX tweaks.
- **Measure, don't guess.** Every phase ends with a verification checklist (Playwright run, Lighthouse pass, security scan, load probe) — not "looks good on my screen".
- **One regression budget.** Each phase includes a smoke-test pass across the 8 core flows before merging.

---

## The 8 Core Flows (the smoke-test spine)

Every phase must leave these working end-to-end:
1. Sign-up → onboarding → first draft
2. Voice capture → transcript → save
3. Knowledge ingest (paste, upload, URL, YouTube, research)
4. Create → generate → save to library (all 40 formats, all channels)
5. Milestone workspace → orchestrated draft
6. Profile / Preset / Voice / Audience switching
7. Brain (3D graph) navigation
8. Media Hub upload → attach to draft

---

## Phase 1 — Stability & Safety (Ship-blockers) — ~1 week

**Why first:** crashes, data loss, and security holes break trust irreversibly.

1. **Error boundaries everywhere.** Audit every route file for `errorComponent` + `notFoundComponent`. Root `defaultErrorComponent` wired to `reportLovableError`.
2. **Fix the SSR hydration mismatch** currently in console logs (`className="dark"` on `<html>` — theme read from storage during SSR). Move to `useEffect` / cookie-based theme.
3. **Server-fn failure hygiene.** Every `createServerFn` returns typed `{ ok, data | error }` instead of throwing raw provider errors. No PII in error messages.
4. **Security scan pass.** Run `security--run_security_scan`; fix every critical/high (RLS gaps, missing GRANTs, anon-exposed tables, service-role leaks). Confirm no `supabaseAdmin` in client-reachable module graph.
5. **Auth edge cases.** Session expiry mid-flow, OAuth cancel, protected serverFn without bearer, sign-out cache teardown.
6. **Data-loss guards.** Draft autosave, unsaved-changes prompt on nav, recording buffer flushed on interruption.

**Exit criteria:** 0 critical security findings, 0 uncaught exceptions in a full Playwright smoke run of the 8 flows, hydration warning gone.

---

## Phase 2 — Correctness & Data Integrity — ~1 week

**Why next:** silently wrong output is worse than a crash.

1. **Orchestrator determinism.** Log every tool call (input/output/latency) to a `run_logs` table; add per-run trace ID surfaced in UI for support.
2. **RLS matrix test.** Automated script: for every table, verify unauthenticated / other-user / owner / admin access matches the intended policy.
3. **Migration audit.** Diff schema vs. `types.ts`; every public table has GRANTs; no orphan columns; no duplicated indexes.
4. **Idempotency.** Draft save, milestone advance, audience set-default all safe on double-click / retry (already fixed for audiences — extend the pattern).
5. **Formatting rule enforcement.** Global lint: no user-facing raw JSON/Markdown — grep for `JSON.stringify` in JSX, verify all AI text passes through `Markdown` primitive.

**Exit criteria:** RLS matrix green, orchestrator trace visible per generation, 0 raw-JSON leaks.

---

## Phase 3 — Performance & Scale — ~1 week

1. **Bundle audit.** `vite build --report`; code-split heavy routes (Brain / Three.js, Media Hub). Target <250KB initial JS.
2. **LCP + preloads.** Set per-route `head().links` preload for hero / logo. Lighthouse mobile ≥90 perf on landing + create.
3. **Query hygiene.** Every `useQuery` has correct `staleTime`; kill duplicate fetchers (Profiles + Audiences fetched twice on DefaultsStrip render).
4. **Server-fn cold path.** Warm/cache Firecrawl/Perplexity/Gemini client init; timeout + circuit-breaker on external providers (research pipeline).
5. **Image pipeline.** All uploaded media through Cloudflare image resizing or `sharp`-free transformer; AVIF/WebP variants for bundled assets.
6. **Three.js Brain.** Frustum culling, LOD on distant orbs, cap DPR at 1.5 on mobile, pause render loop when tab hidden.

**Exit criteria:** Lighthouse mobile ≥90 on 3 key routes, Brain hits 60fps on mid-tier phone, cold research call <8s p95.

---

## Phase 4 — UX Polish & Aesthetic Consistency — ~1 week

1. **Design token audit.** Grep for hardcoded colors (`text-white`, `bg-[#...]`); route all through semantic tokens. Verify dark/light parity on every route.
2. **Empty states.** Every list has a purposeful empty state with a next-action CTA (library, media, audiences, knowledge, workspaces).
3. **Loading states.** No spinner-only screens — skeletons matched to final layout; optimistic UI on all mutations.
4. **Feedback consistency.** Haptics + visual pulse on every actionable button (extending the mic pattern globally via a `TapFeedback` wrapper).
5. **Mobile-first pass.** Every route tested at 375px; thumb-reach for primary actions; safe-area insets on iOS.
6. **Copy polish.** Single voice/style pass across every string; no dev-speak ("Draft", "Untitled", "Item").
7. **Accessibility.** axe-core clean; keyboard nav for all modals; focus rings; `aria-*` on custom radios (audiences card pattern) and orbs.

**Exit criteria:** axe 0 serious issues, all 8 flows pass at 375px, design-token grep is clean.

---

## Phase 5 — Observability & Ops — ~3 days

1. **Structured logging.** Every serverFn logs `{traceId, userId, fn, latency, ok}` — queryable in analytics.
2. **User-facing status.** In-app "something went wrong" surface with trace ID + retry.
3. **Rate limits.** Per-user throttles on expensive endpoints (research, image gen, orchestrator).
4. **Backups & retention.** Confirm Cloud backup cadence; add soft-delete + 30-day recovery on drafts and media.
5. **Feature flags.** Simple boolean flags table for risky rollouts (new formats, orchestrator model swaps).

---

## Phase 6 — Launch Prep — ~3 days

1. **SEO metadata.** Every public route has unique `head()` — title, description, og:image (leaf-only), twitter:card, JSON-LD where applicable.
2. **PWA manifest + icons.** Verify install experience on iOS/Android.
3. **Legal pages.** Terms, Privacy, DPA — public routes, linked in footer + settings.
4. **Onboarding polish.** Time-to-first-draft ≤2 minutes on a fresh account.
5. **Load test.** k6 / Artillery run at 10× expected concurrent users against the 8 flows.
6. **Runbook.** Doc: how to rotate keys, roll back a migration, mute a broken provider, restore a draft.

**Exit criteria:** load test green, runbook exists, publish → smoke test on production URL.

---

## Deliverables per phase

Each phase closes with:
- Written changelog entry
- Updated `mem://` memories for any new rules/constraints
- Playwright smoke run of the 8 core flows
- Security + linter clean
- Screenshot diff of touched routes (light + dark, mobile + desktop)

## Sequencing rationale

Stability → Correctness → Performance → Polish → Ops → Launch mirrors risk-descending order. Phases 1–2 protect the user; 3–4 earn their trust; 5–6 keep it after launch.

## What I need from you before starting

1. Confirm the 8 core flows above match your product priorities (or edit the list).
2. Pick a target launch date so I can compress or extend phases.
3. Confirm scope: full 6 phases, or ship after Phase 3 as a "soft launch" and treat 4–6 as post-launch?
