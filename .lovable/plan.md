# Auto-beautify all CV/résumé imports into rendered Markdown

## Problem

Every résumé that lands in Knowledge (PDF upload, desktop drop, domain drop, LinkedIn paste) is stored as a hand-stitched markdown blob plus a raw dump of `parsed.markdown` appended after `---`. The raw dump is what shows up as the ugly wall of text on the entry card (e.g. `A D A M A N D E R S O N Founder & CEO…`). The `EntryDetailSheet` already renders markdown — the content just isn't beautiful markdown.

Goal: every CV/résumé import, everywhere in the app, is automatically reformatted by AI into clean, human-readable Markdown before it's saved. No manual step, no user toggle.

## Approach

Add a single server function that turns `(structured profile, raw parsed markdown) → beautiful markdown`, and route every résumé/LinkedIn ingest path through it. One choke point, global effect.

### 1. New server fn: `beautifyResumeMarkdown`

File: `src/lib/knowledge/beautify.functions.ts` (client-safe import path, matches existing `extract.functions.ts` sibling).

- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- Input (zod): `{ structured: StructuredProfileSchema, rawMarkdown: string, fileName?: string }`
- Calls `callAnthropic` (which is the orchestrator gateway → currently `openai/gpt-5.6-sol`) with a strict system prompt: "You are a résumé formatter. Return ONLY GitHub-flavored Markdown. Use these sections in this order when data exists: `#` Full name, italic headline line, About, `## Experience` (each role as `### Title — Company` + date range on next line + bullet summary), `## Education`, `## Skills` (comma-joined), `## Achievements` (bulleted), `## Contact` (any emails/urls/locations you can pull from the raw text). Never invent facts. Prefer structured data; use raw text only to fill contact/details/dates that structured missed. No preamble, no code fences."
- Prompt body: JSON of `structured` + `\n\n---RAW---\n\n` + `rawMarkdown.slice(0, 40000)`.
- Return `{ markdown: string }`.
- Fallback: if the model errors or returns empty, fall back to the existing hand-stitched serializer from `ResumeConfirmSheet` (moved into a shared helper `formatResumeFallback(structured, rawMarkdown)` in the same file) so ingest never breaks.

### 2. Wire it into every résumé save path

Only one component actually writes résumés/LinkedIn to `ingestEntry`: `src/components/knowledge/ResumeConfirmSheet.tsx` (used by `UploadSheet`, `DesktopDropzone`, `DomainIngestZone`, and `LinkedInSheet`). Replace its inline `content = […].filter(Boolean).join()` block with:

```
const { markdown } = await beautifyFn({
  data: { structured: profile, rawMarkdown: markdown, fileName: title },
});
// use `markdown` as content
```

Show a small "Formatting résumé…" status while the mutation runs (same pattern as the existing `Saving…` state). One code path, so LinkedIn imports get the same treatment automatically.

### 3. Meta + auditability

- Keep `meta.structured` (already stored) so downstream features that read structured fields don't break.
- Add `meta.formatted_by = "ai"` and `meta.formatter_model = ORCHESTRATOR_MODEL` so we can tell AI-formatted entries from legacy ones later.
- Don't retroactively rewrite existing entries — scope is new imports going forward, matching "based on import and ingest."

## Files touched

- **new** `src/lib/knowledge/beautify.functions.ts` — server fn + `formatResumeFallback` helper.
- **edit** `src/components/knowledge/ResumeConfirmSheet.tsx` — call `beautifyResumeMarkdown` inside `save.mutationFn`, set `meta.formatted_by`, add "Formatting…" status.

Nothing else needs to change — `EntryDetailSheet` already renders markdown, and every résumé/LinkedIn ingest funnels through `ResumeConfirmSheet`.

## Verify

1. Upload a PDF résumé → confirm sheet appears → Confirm & save → open entry → detail sheet shows clean sectioned markdown, not the run-together raw text.
2. Same flow via LinkedIn paste sheet → same beautified result.
3. Force the AI call to throw (temporarily) → ingest still succeeds with the fallback formatter, entry still readable.
4. Check `create_drafts` grounding still works: `meta.structured` is intact.

## Not in scope

- Non-résumé uploads (regular PDFs, notes, audio) — request specifies CVs.
- Backfilling existing entries — new imports only.
- User-facing formatting controls or preview-before-save (auto, per the request).
