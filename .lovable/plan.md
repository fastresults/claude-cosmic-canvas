# Make "Default Knowledge Profile" Obvious

## Problem

Setting a knowledge profile as the global default is currently buried:
- The only affordance is a tiny ★ icon inside a sheet you have to open first
- The DefaultsStrip pill "Set Knowledge" routes to `/settings/knowledge`, which shows no visible way to set a default
- Creating your first (or only) profile does not auto-mark it as default
- Nothing on the Settings index tells you which profile is default or lets you change it

## Fix (3 changes, UI-only + one server tweak)

### 1. Auto-default first profile
In `src/lib/knowledge/knowledge.functions.ts` → `createProfile`: after insert, if the user has no other `is_default = true` knowledge profile, mark the new row as default in the same handler. Same idea as the voice auto-default flow.

### 2. Prominent header control on the CV page
In `src/routes/_authenticated/settings.knowledge.tsx`, next to the `ProfileSwitcherPill`, render a clear status pill for the *currently viewed* profile:
- If it IS the default → static pill: "★ Default profile"
- If it is NOT the default → button pill: "Set as default" (calls `setDefaultKnowledgeProfile`, invalidates `["knowledge","profiles"]`)

This is what the user actually looks for on this page and matches how Voice/Domain rows work.

### 3. Discoverable star + inline default on Settings index
- In `src/components/knowledge/ProfileSwitcherPill.tsx`: keep the ★, but add visible `title` copy "Set as default profile" (already partly there) and a text label under the star on hover-focus rows so it doesn't read as "favorite". Add `aria-pressed` state.
- In `src/routes/_authenticated/settings.index.tsx` Knowledge row: the pill already shows `Default · <name>` when set. When NOT set but profiles exist, replace the "Not set" hint with a small "Set default" quick-picker (dropdown of profiles → calls `setDefaultKnowledgeProfile`) so the user never has to leave the settings index.

## Files touched

- `src/lib/knowledge/knowledge.functions.ts` — `createProfile` auto-defaults when none exists
- `src/routes/_authenticated/settings.knowledge.tsx` — add header default-status/set-default pill
- `src/components/knowledge/ProfileSwitcherPill.tsx` — clearer ★ affordance/label
- `src/routes/_authenticated/settings.index.tsx` — inline "Set default" quick-picker on the Knowledge row

## Out of scope

- Changing the underlying `is_default` schema or `setDefaultKnowledgeProfile` server logic (already correct)
- Voice/Domain redesign (Voice already has adopt-as-default; Domain is a separate ticket if needed)
- Onboarding wizard changes
