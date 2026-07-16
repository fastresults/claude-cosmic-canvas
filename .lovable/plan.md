# Switch orchestrator model to `openai/gpt-5.6-sol`

## What changes

Single-line model swap in `src/lib/orchestrator/config.ts`:

- `ORCHESTRATOR_MODEL = "claude-fable-5"` → `ORCHESTRATOR_MODEL = "openai/gpt-5.6-sol"`

Everything else stays: gateway helper, `orchestrateWithTools`, migrated Milestone pipeline, and every existing caller (`create`, drafts, milestones, knowledge, onboarding, library, content) already reads `ORCHESTRATOR_MODEL` from that constant, so no other files need edits.

## GPT-5.6 Sol required tweaks (per model catalog)

GPT-5.6 models reject function-tool requests unless `reasoning_effort: "none"` is set. Two follow-on edits so tool calls don't 400:

1. `src/lib/orchestrator/config.ts` — change `REASONING_EFFORT` default from `"medium"` to `"none"`.
2. `src/lib/orchestrator/orchestrateWithTools.functions.ts` — pass `providerOptions: { lovable: { reasoningEffort: REASONING_EFFORT } }` on the `streamText`/`generateText` call (if not already wired). This serializes to the `reasoning_effort` body field the gateway expects.

## Verify

- Trigger one Milestone auto-draft run and confirm the gateway log shows `openai/gpt-5.6-sol` with `reasoning_effort: "none"` and no 400.
- Spot-check one non-tool call (e.g. a draft generation via `callAnthropic`) still returns text — that path doesn't send tools, so reasoning effort is safe either way.

## Not in scope

- No UI, no schema, no new tools, no streaming route work. Copilot surface and further migrations remain in the previously-proposed follow-up plan.
