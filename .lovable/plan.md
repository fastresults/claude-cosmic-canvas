# Why nothing was returned or saved

The research call succeeded at the model level but failed at the database insert.

Timeline from AI Gateway + migration history:
- `17:29:48Z` — `runDeepResearch` → Gemini 3 Flash, HTTP 200, 1094 output tokens. Brief was generated.
- `17:29:48Z` (right after) — `ingestEntry` insert with `source_type='research'` violated `knowledge_entries_source_type_check`. Insert rolled back, server fn threw, mutation `onError` fired, UI showed the error, no row saved.
- `17:30:18Z` — migration extended the check constraint to allow `youtube` and `research`.

Result: your one research attempt happened ~30s before the fix. There has been no research request since (gateway log confirms), so you're still looking at the pre-fix failure — not a new bug.

## Plan

1. **Verify** — trigger a research run from a domain sheet. Expected: brief saves and appears in the entry list.
2. **Harden `runDeepResearch`** — if `ingestEntry` throws, re-throw with a message that includes the first ~200 chars of the generated brief so the user (and logs) can see the model output wasn't lost silently. Also log `topic` + `domain_id` server-side for traceability.
3. **Deduplicate `ResearchSheet` mount** — it is currently rendered by both `DomainDetailSheet` and `DomainIngestZone`. Keep it in `DomainIngestZone` only (that's the entry point) to avoid double-mounted state.
4. **No schema changes** — constraint already allows `research`.

## Technical notes

- Files touched: `src/lib/knowledge/research.functions.ts` (wrap `ingestEntry` in try/catch, rethrow with context), `src/components/knowledge/DomainDetailSheet.tsx` (remove duplicate `<ResearchSheet />`).
- No new migrations, no new deps.
- Verification: after build, run a research query; check `_serverFn/...runDeepResearch` returns 200 and `listEntries` refetch includes the new `research` entry.
