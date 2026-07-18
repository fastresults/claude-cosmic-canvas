# Runbook — Eve OS

Ops procedures for keeping the Service healthy in production.

## Rotate API keys

1. **Lovable AI Gateway.** Settings → Cloud → rotate `LOVABLE_API_KEY`. Redeploy.
2. **Supabase publishable / anon.** Rotate from Supabase dashboard (internal), then update the corresponding `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` secrets.
3. **Service role.** Only rotate on suspected compromise. Update `SUPABASE_SERVICE_ROLE_KEY`. Confirm no code references it at module scope of shared files.
4. **Firecrawl / Perplexity.** Update via the Connectors panel; these are managed secrets and cannot be rotated with the raw secrets tool.

## Roll back a migration

1. Identify the migration to revert in `supabase/migrations/`.
2. Author a new migration that inverts the change (drop new column, restore constraint, etc.) — **never** delete or edit a shipped migration file.
3. Ship the reverting migration through the migration tool. Verify with `supabase--read_query` that the schema matches expectations.
4. Regenerate `src/integrations/supabase/types.ts` if columns changed.

## Mute a broken provider

If an external AI provider (Firecrawl, Perplexity, Gemini, Anthropic) is degraded:

1. Flip the relevant feature flag in `feature_flags` (`research.company.enabled`, `orchestrator.tools.enabled`, etc.) to `false`.
2. Users see a friendly "temporarily unavailable" empty state on the affected surface.
3. Post an incident note in `#status`.
4. Re-enable the flag once the provider recovers; monitor **Settings → Activity** for the first 30 minutes.

## Restore a draft or media asset

1. Ask the user to check **Settings → Trash** first — 30-day self-service window.
2. If purged: query `create_drafts` / `media_assets` with `deleted_at is not null` scoped to the user; restore by clearing `deleted_at`.
3. Storage objects in `media-hub` are retained through the 30-day window; after purge, they are unrecoverable unless restored from backup.

## Restore from backup

1. Cloud takes daily automated backups (30-day retention).
2. Open a support ticket to request a point-in-time restore; specify the timestamp and affected tables.
3. Never overwrite `auth.*` schemas — restore into a staging schema and copy rows over.

## Rate-limit incident

1. Check `rate_limits` table for the offending `(user_id, action)` pair.
2. Adjust the window/limit in `src/lib/rate-limit/rate-limit.server.ts` if the ceiling is wrong for the workload.
3. For a single user under attack, escalate to security review before manually clearing counters.

## Deploy checklist (per release)

- Playwright smoke of the 8 core flows (see `.lovable/plan.md`).
- `security--run_security_scan` shows 0 critical / high.
- `supabase--linter` clean or with known-accepted findings only.
- Lighthouse mobile ≥ 90 on `/`, `/create`, `/library`.
- Manual pass on 375px width for every touched route.
- Publish, then re-run smoke against the production URL.
