## Where Audience is actually wired today

Audits show Audience is a table + settings page + `useUserDefaults` pill, but it stops there. It is **not** wired into the surfaces that matter:

| Surface | Audience today |
|---|---|
| `DefaultsStrip` pill row | ✅ shown (fourth pill) |
| `settings/audiences` CRUD + AI drafter | ✅ works |
| `default_profiles` schema (`audience_id`) | ✅ column exists |
| **Profile create/edit sheet** | ❌ no Audience selector — profiles can't bundle an audience |
| **Profile card chips** (`SlotChip`) | ❌ only Voice/Knowledge/Domain shown |
| **`applyProfile`** swap | Partially — swaps audience default only if profile has one, but UI can't set it |
| **Create flow prompt** (`create.functions.ts`) | ❌ audience never injected into the model system prompt |
| **Draft regeneration / image prompts** | ❌ uses free-text `audience` string from draft, not the structured ICP |
| **Orchestrator system prompt** (`system.server.ts`) | ⚠️ only via `MilestoneContext`; generic/create/copilot surfaces don't receive audience |
| **Milestone `StrategyPanel` / actor** | ⚠️ mentions "audience" as concept, doesn't load active audience ICP |
| **`presets/injection.ts` `[AUDIENCE]` block** | ❌ file exists, zero callers |
| **Channel-aware social prompts** | ❌ channel rules ignore audience persona |
| **`RequireDefaultsGate`** | ❌ doesn't require Audience before creating |

Net: the user set an Audience, but no generation call ever sees it.

## Plan — make Audience a first-class input everywhere

### 1. Profile bundle wiring (UI gap that user is looking at)
- `settings.default-profiles.tsx` → `CreateProfileSheet`: add Audience `<Select>` fed by `listAudiences`; store `audienceId`; pass to `createProfile`.
- `SlotChip`: add `"audience"` kind + `Users` icon; render fourth chip on each profile card.
- Support edit (not just create) so existing profiles can attach an audience.
- Profile description helper text: "Voice + Knowledge + Domain + Audience".

### 2. Prompt injection (make the model actually use Audience)
- New helper `renderAudienceBlock(audience)` in `src/lib/audiences/render.ts` — formats ICP: role, seniority, industry, pains, goals, objections, channels.
- `composeOrchestratorSystem` (system.server.ts): accept `audience` arg; append `[AUDIENCE]` block for **all** surfaces (create, milestone, copilot, brain), not just milestone context.
- `create.functions.ts` generation path: load active audience (from profile or user default) and pass into system compose. Same for regenerate + section rewrites in `drafts.functions.ts`.
- Channel-aware social prompts: prepend audience tone constraint per channel (e.g. "Write for {ICP}; use their vocabulary; address {top_pain}").
- Milestone `StrategyPanel` / `actor.ts` `contextBlock`: pull structured audience instead of free-text `audience` string.

### 3. Draft ↔ Audience linkage
- `drafts` table already stores free-text `audience`; add `audience_id` FK (nullable). Backfill from active profile at draft create.
- `saveDraft` / `regenerateDraft`: read `audience_id`, resolve ICP server-side, inject.
- Draft header: show a small "For: {audience name}" chip so the user sees what the model is targeting.

### 4. Gates + guidance
- `RequireDefaultsGate`: include `audience` in required set (currently silent). Blocking copy: "Pick an audience so Eve writes for a specific reader."
- Empty-state on Create/Milestone: if no audience, offer one-tap "Draft one with AI" (reuses existing `suggestAudienceFromContext`).

### 5. Orchestrator awareness
- System prompt gains rule: "Always speak to the [AUDIENCE]. If the audience is missing, ask before drafting."
- `MILESTONE_ACTOR_SYSTEM`: add explicit "rank channels by fit to [AUDIENCE.channels]".

### Files touched
- `src/routes/_authenticated/settings.default-profiles.tsx` (audience selector + chip)
- `src/lib/profiles/profiles.functions.ts` (already accepts `audience_id`; add update handler if missing)
- `src/lib/audiences/render.ts` (new)
- `src/lib/orchestrator/system.server.ts` (audience block for all surfaces)
- `src/lib/workspaces/context.server.ts` (structured audience)
- `src/lib/create/create.functions.ts` + `src/lib/drafts/drafts.functions.ts` (resolve + inject)
- `src/lib/create/format-rules.ts` (channel × audience tone hooks)
- `src/components/settings/RequireDefaultsGate.tsx` (require audience)
- DB migration: `drafts.audience_id uuid references audiences(id)` (nullable, ON DELETE SET NULL)

### Out of scope
- Rewriting the AI audience drafter itself (already working per last turn).
- Analytics on audience performance (future).
