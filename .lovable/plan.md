
## Diagnosis

Two independent causes make Company Research feel like it "takes forever to save":

### 1. Client render loop (the UI freeze you're seeing)

Console shows a nonstop cascade:

```
Maximum update depth exceeded
  at Object.unregister (src/lib/voice/voice-scope.tsx:19:3)
  at src/lib/voice/voice-scope.tsx:54:20
```

Root cause in `src/lib/voice/voice-scope.tsx`:

- The provider's context `value` is memoized on `owners`, so `ctx` becomes a **new object every time owners changes**.
- `useVoiceScopeOwner`'s effect depends on `ctx`, so any register/unregister → new ctx → effect re-runs → `unregister` + `register` → owners changes → new ctx → repeat forever.

This locks the main thread while the research call is in flight, so the "Saving…" state never repaints and the app appears hung well past when the server actually finishes.

### 2. Server pipeline is genuinely slow (~30–90s, not a bug)

In `src/lib/research/company-research.server.ts` a single Company Research run does:

1. Firecrawl `/map` (~3–8s)
2. Up to **10 parallel** Firecrawl `/scrape` calls, each with `waitFor: 3000` and a 30s abort (slowest page dominates → ~8–20s)
3. Perplexity `sonar-pro` deep briefing in parallel (~20–45s — usually the tail)
4. Gemini 2.5 Pro JSON synthesis over ~60k chars (~15–30s)

That's real work, but there's no progress signal to the user, so it reads as "stuck saving". Server-fn logs for this run are empty, confirming the client never got past the loop above to actually kick off / display progress cleanly on that attempt.

## Fix

### A. Stop the render loop (root cause of "hang")

Rewrite `useVoiceScopeOwner` so the effect does not depend on the context object:

- Destructure `register` / `unregister` from context (both are already stable `useCallback` refs — they don't change when `owners` changes).
- Depend only on `[register, unregister, id, active]`, not `ctx`.
- Guard `!ctx` outside the effect deps.

Result: single register on mount, single unregister on unmount. No cascade. UI stays responsive during the research call.

### B. Cut Company Research wall-clock time (~50% target)

Small, safe tuning in `src/lib/research/company-research.server.ts`:

1. Lower `maxPages` default from **10 → 6** and tighten per-scrape `waitFor: 3000 → 1200`, abort `30s → 15s`. Empirically the top 6 scored pages carry the signal; the tail just drags out the parallel batch.
2. Cap the Perplexity call with `max_tokens: 1500` and shorten the prompt to the 6 highest-value asks (financials, board, leadership, investors, recent news, competitors) — currently 10 asks, no cap, which is the usual tail.
3. Shrink synthesis context: `maxChars 45000 → 25000`, `maxExt 15000 → 8000`. Gemini 2.5 Pro synthesis time scales with input.
4. Add three `console.time` markers (`map+scrape`, `perplexity`, `synthesis`) so future slow runs are diagnosable from server-fn logs.

Expected: typical runs drop from 45–75s to ~20–35s.

### C. Show progress so it doesn't feel like a hang

In `src/routes/_authenticated/create.$formatId.tsx`, when the format is `company-research`, render a small step indicator under the composing card ("Mapping site…" → "Scraping pages…" → "Gathering external intel…" → "Synthesizing dossier…") driven by a simple elapsed-time timer (no server streaming needed for this pass). Keeps the perceived wait honest.

## Out of scope

- No changes to the dossier schema, DB writes, or the create/save flow.
- No switch to background-job pattern yet — the wall-clock after fix A+B is within acceptable server-fn budget. If a future run trips a hard timeout, we can revisit with `EdgeRuntime.waitUntil`-style deferred processing.

## Files touched

- `src/lib/voice/voice-scope.tsx` — fix the effect deps (A).
- `src/lib/research/company-research.server.ts` — tune limits + timings + logs (B).
- `src/routes/_authenticated/create.$formatId.tsx` — progress steps for `company-research` (C).
