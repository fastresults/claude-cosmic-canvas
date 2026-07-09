
# Verify model IDs against Anthropic's own API

Query Anthropic's models endpoint directly using your saved `ANTHROPIC_API_KEY` and print the raw list of model IDs Anthropic itself says exist. Whatever comes back is the ground truth — no third-party sources involved.

## What I'll run

A single shell command:

```bash
curl -s https://api.anthropic.com/v1/models \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); [print(m['id']) for m in d.get('data', [])] if 'data' in d else print(d)"
```

This lists every model ID your key can access. No files change.

## What we decide from the output

- **If `claude-fable-5` appears in the list** → I immediately update `src/lib/orchestrator/config.ts` to `claude-fable-5`. Full apology, no further debate.
- **If it doesn't appear** → we keep `claude-sonnet-4-5` (or you pick another ID from the returned list) and move on to your PRD.

That's the whole plan. Approve and I'll run it.
