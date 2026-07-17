## Diagnosis (confirmed from logs)

- The gateway call at `2026-07-17T19:14:23Z` (log_id `019f7180-4790-744b-8780-4318c395f747`, model `google/gemini-3-flash-preview`) returned **HTTP 200** with 358 output tokens — the model responded.
- Server log shows: `[audiences] suggest failed NoObjectGeneratedError [AI_NoObjectGeneratedError]: No object generated: response did not match schema.`

So the model produced content, but the AI SDK's post-hoc validation rejected it against the strict `OutSchema` in `suggestAudienceFromContext`. Every field in that schema is required (strings must be present, arrays must be arrays). If Gemini omitted one — e.g. left `company_size` off, or returned `null` — the whole call throws and the UI shows "Could not generate an audience right now."

This is exactly the failure mode the AI SDK knowledge file warns about: strict output schemas throw at runtime on otherwise-successful gateway calls, and the fix is a fallback parse plus a looser schema.

## Fix (single file: `src/lib/audiences/audiences.functions.ts`)

1. **Loosen `OutSchema`** so every field tolerates model omissions:
   - `name`, `description`, and every string ICP field: `z.string().nullish()`.
   - Every array ICP field: `z.array(z.string()).nullish()`.
   - The whole `icp` object: `.nullish()`.
   Keep it flat, no bounds, no enums — same rule as before.

2. **Guard the `generateText` call with a fallback** per AI SDK guidance:
   ```ts
   import { generateText, Output, NoObjectGeneratedError } from "ai";
   try { … output = result.output }
   catch (e) {
     if (NoObjectGeneratedError.isInstance(e)) {
       output = safeJsonParse(e.text) ?? {};
     } else throw e;
   }
   ```
   `safeJsonParse` strips ```json fences if present and returns `null` on failure.

3. **Normalize the result** before returning, so a partial response still yields a valid audience:
   - Coerce every string field with `?? ""`.
   - Coerce every array field with `?? []` and filter to non-empty strings.
   - Feed the normalized object through the existing `IcpSchema.parse(...)` (which already defaults missing fields).
   - If `name` came back empty, fall back to a deterministic name like `"${domainName || "General"} audience"` so the UI never gets a blank.

4. **Keep the outer error message** for true failures (network, 5xx), but no longer throw on schema mismatch — the fallback path returns a usable audience.

No other files change. No schema/db changes. No UI changes.

## Verification

- Retry "Suggest with AI" on `/settings/audiences` and confirm fields populate.
- Check server logs — the `[audiences] suggest failed NoObjectGeneratedError` line should no longer appear on a normal run; if it does, the fallback parse now recovers instead of throwing.
