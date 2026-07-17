
## What's actually happening

Two independent problems collided on `/create/company-research`:

1. **The visible error** ("Unsupported parameter: `max_tokens` is not supported with this model. Use `max_completion_tokens` instead.") is from GPT-5.6. Every `/create/*` format — including Company Research — goes through the generic `runGenerateCreateDraft` → `callAnthropic` path, which passes `maxOutputTokens` to the AI SDK. The openai-compatible provider serializes that to `max_tokens`, and GPT-5.6 (`openai/gpt-5.6-sol`) rejects it. So today every format is failing on generation with this model, and Company Research is no exception.

2. **Company Research has no research capability.** `company-research` is just a row in `CREATE_FORMATS` with `defaultLength: 1200`. There is no Firecrawl call, no site map/scrape, no external intelligence — it's the same generic prompt loop as every other format. This is what makes the output shallow rather than McKinsey-grade.

The Thought Leader Studio workspace has a full reference implementation at `supabase/functions/research-company-profile/index.ts`: Firecrawl `/v1/map` → rank & scrape top ~10 pages → parallel Perplexity `sonar-pro` enrichment → single LLM synthesis into a structured dossier.

## Plan

### 1. Fix the GPT-5.6 `max_tokens` error (blocks every format today)

In `src/lib/orchestrator/anthropic.server.ts`, stop passing `maxOutputTokens` on the openai-compatible path for GPT-5.6 (it does not accept `max_tokens`). Instead, forward the limit as `max_completion_tokens` via `providerOptions.lovable` — passthrough field the gateway relays. Also set `reasoningEffort: "none"` per the GPT-5.6 rule. This is a one-file change that unblocks every `/create/*` format immediately.

### 2. Build a real Company Research pipeline (port from Thought Leader Studio)

Link the existing workspace Firecrawl and Perplexity connections to this project (both already exist, `linkable: yes`) so `FIRECRAWL_API_KEY` and `PERPLEXITY_API_KEY` are available in server functions.

Create `src/lib/research/company-research.server.ts` mirroring the Thought Leader Studio edge function, adapted for our TanStack server runtime:

- `discoverAndScrapePages(baseUrl, maxPages=10)` — Firecrawl `/v1/map` → rank URLs by the same high-value regex set (about/team/leadership/investors/products/press/customers/mission), scrape top pages in parallel via Firecrawl `/v1/scrape` (markdown, main-content only).
- `searchExternalIntelligence(name, url)` — Perplexity `sonar-pro` prompt for financials, board, investors, news, competitors, partnerships, awards, customers.
- `synthesizeDossier(...)` — one call through our existing Lovable AI gateway helper using the same McKinsey-caliber system + user prompt and the exact JSON schema (company, founders, boardAndAdvisors, funding, fundingRounds, competitors, recentNews, techStack, market, redFlags, keyProducts, partnerships, awards, customers, strategicInsights). Use `google/gemini-2.5-pro` (matches source project and handles the ~60k context window well) with `response_format: { type: "json_object" }`.

Create `src/lib/research/company-research.functions.ts` exporting `runCompanyResearch` as a `createServerFn` with `requireSupabaseAuth` middleware. Input: `{ companyName, companyUrl, additionalContext? }`. Output: the parsed dossier plus `pagesScraped` and `processingTimeMs`.

### 3. Route Company Research through the new pipeline

`company-research` becomes a special case in the `/create/$formatId` flow rather than going through generic draft generation:

- Update `src/routes/_authenticated/create.$formatId.tsx` (or extract a small `CompanyResearchPage` view) so when `formatId === "company-research"`, the page renders a two-field form (Company name, Company URL) plus optional context — matching the seed field in the screenshot but split so we have a clean URL to feed Firecrawl. Parse `smokerisecc.com` out of the current single-seed input as a fallback.
- On submit, call `runCompanyResearch` instead of `generateCreateDraft`. Show a progress state (`Mapping site… Scraping N pages… Enriching with external intelligence… Synthesizing dossier…`).
- On success, render the dossier through a new `CompanyDossier.tsx` component: fully-formatted human-readable sections (company overview, founders, board, funding table, funding-round timeline, competitors, recent news, tech stack, market, products, partnerships, awards, customers, strategic insights, red flags). Uses our existing `Markdown` primitive for prose fields and typed sub-components for lists/tables. No raw JSON exposed (per global rule).
- Persist the run as a `create_drafts` row: `format_id: 'company-research'`, `title: <companyName> — Corporate Research`, and `sections` = the human-readable sections we render (so it opens back up cleanly from Drafts). Also stash the full structured dossier in `brief_snapshot` for re-rendering.
- Keep the mandatory-title gate but auto-suggest `${companyName} — Corporate Research` so the user just confirms.

### 4. Errors and quotas

Surface the same class of errors we already handle (rate limits, credit exhaustion, "site blocked automated access") as user-visible messages, and gate the button while the (~20–40s) pipeline runs. If Perplexity is unavailable, the pipeline still returns a Firecrawl-only dossier (as in the source implementation).

## Technical details

**Files changed / added**
- `src/lib/orchestrator/anthropic.server.ts` — swap `maxOutputTokens` for `providerOptions.lovable.max_completion_tokens` + `reasoningEffort: "none"`; keep signature identical.
- `src/lib/research/company-research.server.ts` — Firecrawl map+scrape, Perplexity enrichment, AI synthesis.
- `src/lib/research/company-research.functions.ts` — `runCompanyResearch` server function (auth-protected).
- `src/routes/_authenticated/create.$formatId.tsx` — branch for `company-research`; new inputs + progress + dossier rendering.
- `src/components/research/CompanyDossier.tsx` — human-readable dossier renderer (no raw JSON).
- Connectors: link workspace Firecrawl (`std_01kehw9dndfw69cws03zczc1f3`) and Perplexity (`std_01kf712bdbfw29g7m4xr9qytrk`) to this project via `standard_connectors--connect`. Both are direct-API (`uses_connector_gateway: false`), so server code reads `process.env.FIRECRAWL_API_KEY` and `process.env.PERPLEXITY_API_KEY` and calls `api.firecrawl.dev/v1/*` and `api.perplexity.ai` directly (per firecrawl knowledge).
- No DB schema change: reuse `create_drafts` with `sections` (rendered) + `brief_snapshot` (structured).

**Known trade-offs**
- Synthesis model is `google/gemini-2.5-pro` for context capacity and JSON-mode reliability — different from the app's `openai/gpt-5.6-sol` orchestrator, and intentional (matches the reference project). Not changing the global orchestrator.
- Pipeline is synchronous (~20–40s). If it later needs to run longer, we'd move it behind a background job — out of scope now.

## Open question before I build

The screenshot shows a single seed field ("Search Smoke Rise Country Club in Tucker GA / smokerisecc.com"). Do you want me to:
(a) split it into explicit **Company name** + **Company URL** fields (cleaner, matches the reference implementation), or
(b) keep one seed box and auto-extract the domain from whatever they type/paste?
