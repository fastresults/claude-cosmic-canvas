## Problem
Profile cards in `/settings/default-profiles` show Apply, Set-default, and Delete — but no way to edit name, description, emoji, or the four pillar slots (Voice / Knowledge / Domain / Audience). Users can only recreate from scratch.

## Plan

**1. Add a Pencil (Edit) button to each profile row**
In `src/routes/_authenticated/settings.default-profiles.tsx`, next to the Apply / Check / Trash controls, add a `Pencil` icon button that opens the same profile sheet in edit mode for that profile.

**2. Generalize `CreateProfileSheet` → `ProfileSheet`**
Refactor the existing sheet so it accepts an optional `profile` prop:
- No `profile` → "New profile" (existing behavior, calls `create`).
- With `profile` → "Edit profile", pre-fills name / description / emoji / voice_id / knowledge_profile_id / domain_id / audience_id, and Save calls `update.mutateAsync({ id, ...fields })`.
- Preserve reset-on-close and the "must have name" guard.
- Use `useEffect` to sync state when the `profile` prop changes so switching which row is being edited repopulates fields.

**3. Wire up the existing `update` mutation**
`useDefaultProfiles()` already exposes `update` backed by `updateDefaultProfile` — no server or schema changes needed. Add it to the sheet's hook destructure and use it in the edit branch.

**4. Page state**
Replace `creating: boolean` with `editing: { mode: "create" } | { mode: "edit"; profile } | null` (or two states) so the FAB opens create mode and the pencil opens edit mode targeting a specific row.

**5. No changes to**
Server functions, database schema, `useDefaultProfiles`, or the SlotSelect/VoicePicker internals.

## Files touched
- `src/routes/_authenticated/settings.default-profiles.tsx` (only)

## Out of scope
Inline rename in the card (kept in the sheet so all four pillar slots are editable together with the same rich picker UX as create).