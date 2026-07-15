## Goal

Make the three global defaults — **Voice**, **Curriculum Vitae (Knowledge)**, **Domain** — impossible to miss, and refuse content/milestone/campaign creation until all three are set.

## 1. Settings list: inline "default" pills

In `src/routes/_authenticated/settings.index.tsx`, augment each row for Voice & Style, Curriculum Vitae, and Domains with a right-aligned pill showing the current default in a distinctive display font (`font-display`, accent color, rounded-pill).

- Row shows `Default: <name>` in accent pill when set.
- Row shows `Not set` in destructive pill when missing.
- Data comes from the same three queries already used in `DefaultsCard` (`voice-active`, `knowledge/profiles`, `settings/domains`) — hoist into a shared `useUserDefaults()` hook in `src/hooks/useUserDefaults.ts` so the settings list, `DefaultsCard`, top bar, and create-gate all share one source of truth.
- Remove/downgrade the standalone `DefaultsCard` above the list since the info now lives on each row (keep a slim "Your defaults" summary line at the very top: `Voice · Knowledge · Domain` with green/red dots).

## 2. Persistent global visibility

Add a compact **DefaultsStrip** just below the top bar on every authenticated route (mount in `src/routes/_authenticated/route.tsx` so it renders once for the whole shell).

- Three tiny pills side-by-side: Voice, Knowledge, Domain.
- Each pill: icon + short name when set (accent styling), or `Set <thing>` in destructive styling when missing, linking to the right settings page.
- Collapses to a single "⚠ Setup required" pill on narrow screens when any default is missing; expands on tap.
- Reuses `useUserDefaults()` so it updates instantly after a change.

## 3. Gate content / milestone / campaign creation

Add `src/components/settings/RequireDefaultsGate.tsx`:

- Reads `useUserDefaults()`.
- If any of voice / knowledge / domain is missing, replaces its children with a friendly empty state: heading "Set your defaults first", three checklist rows (✓/✗) each linking to the matching settings page, and a disabled primary action explaining why.
- If all set, renders `children` untouched.

Wrap the gate around the entry points that produce content:

- `src/routes/_authenticated/create.index.tsx` — wrap the whole `CreateHub` body.
- `src/routes/_authenticated/create.$formatId.tsx` — wrap the composer.
- `src/components/workspaces/MilestonePrepSheet.tsx` — replace sheet body with the gate when defaults missing (so "New milestone" from any surface is blocked).
- `src/routes/_authenticated/workspaces.index.tsx` — gate the "New milestone" CTA the same way (button becomes "Finish setup" linking to `/settings`).

Server-side belt-and-suspenders: in `generateCreateDraft` (create.functions.ts) and the milestone create path (workspaces.functions.ts), after resolving defaults via `resolveUserDefaults`, throw a typed `{ error: "defaults_missing", missing: [...] }` when any of the three are null. The client already surfaces server errors; the gate prevents users from ever hitting this.

## 4. Persistence guarantee

Defaults already persist in Postgres (`profiles.active_voice_id`, `knowledge_profiles.is_default`, `domains.is_default`). What's changing:

- `useUserDefaults()` centralizes cache keys so every mutation (`setDefaultVoiceProfile`, `setDefaultKnowledgeProfile`, `setDefaultDomain`) invalidates one place and every consumer updates.
- The three surfaces above (settings rows, global strip, create gate) all subscribe, so a change made anywhere is visible everywhere on the next render — no stale UI.

## Files

**New**
- `src/hooks/useUserDefaults.ts`
- `src/components/settings/DefaultsStrip.tsx`
- `src/components/settings/RequireDefaultsGate.tsx`

**Edited**
- `src/routes/_authenticated/settings.index.tsx` — inline pills per row, slim summary, drop full `DefaultsCard`.
- `src/components/settings/DefaultsCard.tsx` — either deleted or reduced to the slim summary line.
- `src/routes/_authenticated/route.tsx` — mount `<DefaultsStrip />`.
- `src/routes/_authenticated/create.index.tsx` — wrap in gate.
- `src/routes/_authenticated/create.$formatId.tsx` — wrap in gate.
- `src/components/workspaces/MilestonePrepSheet.tsx` — gate inside sheet.
- `src/routes/_authenticated/workspaces.index.tsx` — gate the new-milestone CTA.
- `src/lib/create/create.functions.ts` — server-side defaults check in `generateCreateDraft`.
- `src/lib/workspaces/workspaces.functions.ts` — server-side defaults check on milestone create.

## Out of scope

Preset defaults, per-draft override UX, and any change to how defaults are computed server-side (already handled by `resolveUserDefaults` from the previous turn).
