## Add "Create new" shortcut to every pillar picker

Right now the Voice, Domain, Knowledge, and Audience selectors on `/settings/default-profiles` are plain native `<select>` menus (except Voice, which is the new `VoicePicker` dialog). If a user doesn't see the option they want, there's no path forward from inside the picker — they have to know to navigate to the correct settings page themselves.

### Goal
Every pillar picker exposes a clear "Add / build new" affordance that deep-links to the correct settings screen.

### Changes

1. **Replace remaining native selects with a consistent `PillarPicker` dialog** (same pattern as `VoicePicker`) for Domain, Knowledge, and Audience on `settings.default-profiles.tsx`. Each picker:
   - Search + list of existing items (deduped case-insensitively)
   - Sticky footer row: **"+ Create new [Domain/Knowledge/Audience]"** → navigates to the matching settings route and closes the dialog
   - Empty-state variant: when no items exist, the primary CTA is the same "Create new" link with helper copy

2. **Update `VoicePicker`** to add the same sticky footer row: **"+ Create a new Voice"** → `/settings/voices` (or wherever voice creation lives). Keeps the existing "Add + use" inline adoption for system voices.

3. **Route mapping** used by the shortcut:
   - Voice → `/settings/voices`
   - Domain → `/settings/domains`
   - Knowledge → `/settings/knowledge`
   - Audience → `/settings/audiences`
   (Verify exact paths during implementation; use the ones already registered.)

4. **Return behavior**: after creating a new item in settings and returning to the profile screen, the picker's list refreshes (invalidate the relevant query) so the new item is immediately selectable.

### Out of scope
- No changes to the settings pages themselves.
- No changes to how profiles are saved.
- No new pillars.

### Files touched
- `src/routes/_authenticated/settings.default-profiles.tsx`
- `src/components/pickers/VoicePicker.tsx`
- New: `src/components/pickers/PillarPicker.tsx` (shared shell for Domain/Knowledge/Audience)
