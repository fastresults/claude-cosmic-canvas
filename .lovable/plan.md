## Goal
Let the user rename their identity label (currently the hard-coded "Personal" knowledge profile) directly from the UI. The new name flows to every surface that reads that profile — the Curriculum Vitae switcher pill, the Defaults strip "Knowledge" chip, and any prompt/context that quotes the knowledge profile name.

## Where "Personal · Personal" comes from
The pill in the screenshot is `ProfileSwitcherPill` on `/settings/knowledge`. It renders `active.name · KIND_LABELS[active.kind]`. The default seed row is created in `knowledge.functions.ts` as `{ name: "Personal", kind: "personal" }`, which is why both halves read "Personal". Today there is no rename UI or server function for knowledge profiles.

## Changes

### 1. Server — add rename function
`src/lib/knowledge/knowledge.functions.ts`
- Add `renameKnowledgeProfile` (POST, requireSupabaseAuth). Zod input: `{ id: uuid, name: string(1..80) }`. Updates `knowledge_profiles.name` scoped to `user_id`.

### 2. UI — inline rename in the switcher sheet
`src/components/knowledge/ProfileSwitcherPill.tsx`
- Add a small pencil button on each row in the sheet. Clicking swaps the name into an inline `<input>` with Save / Cancel.
- Wire to `renameKnowledgeProfile`; on success invalidate `["knowledge","profiles"]` and `["default-profiles"]` (the profile card may reference this row).
- Also add a pencil affordance next to the active pill's chevron so the user can rename without opening the sheet.

### 3. UI — rename button on the CV page header
`src/routes/_authenticated/settings.knowledge.tsx`
- Next to the "Curriculum Vitae" page title, surface the active profile name as an editable chip ("Identity: Personal ✎") that opens the same rename flow. This is what makes the fix discoverable from the screen the user is on.

### 4. Propagation
- The Defaults strip "Knowledge" chip already reads from `listProfiles` → updates automatically.
- The Brain graph "You" node reads from the active **default profile** (`default_profiles` table, separate from knowledge profile) and is already editable via Settings → Profiles. No change needed there; renaming the knowledge profile does not rename the Profile bundle.

## Out of scope
- Renaming `KIND_LABELS` (the "· Personal" suffix comes from the profile's `kind`, a category, not the identity). If the user wants that suffix hidden once they've renamed the profile, we can drop the kind suffix when `name.toLowerCase() === KIND_LABELS[kind].toLowerCase()` — flag if desired.
- No schema migration needed; `knowledge_profiles.name` already exists and is user-writable under RLS.
