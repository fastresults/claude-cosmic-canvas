# Make AI workflows durable and streamlined

## Short answer
Partly. Data security and page loading are solid. The AI workflows are not yet durable:
- The longest jobs (milestone "Draft all", copilot, research) run as one long request with no live progress.
- Two of those loops send a setting the model rejects, so they can fail outright.
- Errors are often hidden: research quietly continues with empty sources, Brain links silently fail, and "out of credits" or "busy" shows as technical text.
- Model choices, AI helpers and JSON parsing are duplicated across about 10 files, so fixes land in one place but not the others.

## What we'll do (in order, each step ships on its own)

1. **Fix the failing orchestrator calls.** Milestone "Draft all" and copilot runs will send the correct settings, through one shared helper.
2. **Friendly, honest errors.** Out of credits, busy and blocked each get a clear message. The app will retry briefly when it's just busy, raw error text is never shown, and Brain-link failures show a small notice.
3. **Honest research results.** If some sources fail, the entry is marked "Partial". If all of them fail, the user is told instead of getting an empty dossier.
4. **One home for AI setup.** Merge the two duplicate AI connection files and add a single list of which model does which job.
5. **Reliable structured answers.** Onboarding, library, image ideas and research will use enforced response formats instead of guessing at the text, so a chatty reply can't crash a step.
6. **Live progress for long jobs.** Milestone runs and draft generation will show results as they're written, with the current progress polling kept as a backup.
7. **Per-page error screens.** Every signed-in page gets a "Something went wrong — Try again" card, so one failure doesn't blank the app.
8. **Guardrails.** Add rate limits to the AI actions that have none (voice, drafts, presets, library, onboarding) and cap response lengths.

Not included (later): large-file splits, removing type casts, model upgrades (these need your answers to the audit's open questions).

## Technical details
- Step 1: `orchestrateMilestone.functions.ts`, `orchestrateWithTools.functions.ts` → use `providerOptions.lovable { max_completion_tokens, reasoningEffort: "none" }` via an exported helper from `anthropic.server.ts`. Keep the model, tools and step limit unchanged.
- Step 2: a status mapper in `gateway.server.ts` (402/403/429/5xx). Backoff only on 429/5xx, at most 2 retries, honouring Retry-After. `brain/edges.ts` returns errors to callers, which show a sonner toast.
- Step 3: `company-research.server.ts` tracks failed sources and stores a partial flag in the entry metadata.
- Step 4: merge `src/lib/orchestrator/gateway.server.ts` into `src/lib/ai/gateway.server.ts`, and add `src/lib/ai/models.ts`.
- Step 5: `Output.object` + zod (strict json_schema), keeping the existing fallbacks.
- Step 6: a streaming server route using `streamText` with the same tools and system prompt. The client reads the stream, and `getWorkspaceProgress` stays as the fallback.
- Step 7: a shared `RouteError` component set as `errorComponent` on `_authenticated/*` routes.
- Step 8: extend `RATE_LIMITS` in `rate-limit.server.ts` and add caps where missing.
- Verification after each step: clean build, plus a Playwright run of the affected flow (Draft all, research, onboarding) signed in, and an AI Gateway log check for 200s.
