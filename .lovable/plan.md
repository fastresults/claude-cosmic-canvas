
# Anthropic Orchestrator Scaffold

Set up a server-side orchestrator that calls the Anthropic API using your key, so once you post the PRD we can immediately wire tools and product logic into it.

## Model note (important)
I could not verify `claude-fable-5` as an Anthropic model ID. To avoid shipping a call that will 404 on Anthropic's side, the scaffold uses `claude-sonnet-4-5` as a **placeholder constant in one file** (`src/lib/orchestrator/config.ts`). Swap it to whatever exact ID your Anthropic console lists — a one-line change, no other code moves.

## What gets built

1. **Secret setup**
   - Prompt you (via the secure secret form) for `ANTHROPIC_API_KEY`. Stored as a runtime env var; never shipped to the browser.

2. **Server-only Anthropic client** — `src/lib/orchestrator/anthropic.server.ts`
   - Thin `fetch`-based wrapper around `POST https://api.anthropic.com/v1/messages`.
   - Reads `process.env.ANTHROPIC_API_KEY` inside the call (not at module scope) so Cloudflare Workers runtime injection works.
   - Sends `anthropic-version: 2023-06-01` header.
   - Returns typed `{ text, stopReason, usage }`.

3. **Orchestrator server function** — `src/lib/orchestrator/orchestrate.functions.ts`
   - `createServerFn({ method: "POST" })` with Zod-validated input `{ prompt: string, system?: string }`.
   - Calls the Anthropic client, returns the response to the client.
   - Handler-local imports only (per TanStack server-fn splitting rules).

4. **Minimal test UI** — replace the placeholder `src/routes/index.tsx`
   - Textarea + "Run" button that calls the server fn via `useServerFn` and renders the model's response.
   - Purely a smoke test so you can confirm the key + model ID work before the PRD lands. Will be replaced by real product UI later.

5. **Config file** — `src/lib/orchestrator/config.ts`
   - Exports `ORCHESTRATOR_MODEL = "claude-sonnet-4-5"` (change to the real ID you want).
   - Exports `MAX_TOKENS` default.

## Files touched
- `src/lib/orchestrator/config.ts` (new)
- `src/lib/orchestrator/anthropic.server.ts` (new)
- `src/lib/orchestrator/orchestrate.functions.ts` (new)
- `src/routes/index.tsx` (replace placeholder)
- Secret: `ANTHROPIC_API_KEY` (via secure form)

## Not in this step
- No database, auth, or tool-calling loop yet — those depend on the PRD.
- No streaming; adds cleanly later once product shape is known.

## After this scaffold
Post your PRD. We'll layer the actual orchestration logic (tools, memory, routing, UI) on top of this foundation.
