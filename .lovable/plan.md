## Plan: robust Voice picker for Profiles

### What I confirmed
- The Profile creation screen currently uses a native `<select>` for Voice, so it only shows the small set of already-adopted user voices.
- The backend has a larger visible system voice library available separately: 54 curated voices across categories.
- The current Profile voice picker does not expose that library, category filtering, rich descriptions, or adoption from the picker.

### Build the improved picker
1. **Replace the native Voice dropdown only**
   - Keep Knowledge, Domain, and Audience selectors as-is for now.
   - Replace the Voice `<select>` in the Profile creation sheet with a full-screen/mobile-first picker dialog or bottom sheet.

2. **Show both available voice sources**
   - **My voices**: voices the user already has saved/adopted.
   - **Voice library**: all visible curated system voices.
   - If the user selects a library voice, adopt/save it first, then select it for the Profile automatically.

3. **Add robust filtering**
   - Search by voice name, profession, tagline, category, and tone.
   - Category chips/tabs such as Public Figures, Business Leaders, Consulting & Strategy, Marketing & Sales, etc.
   - Quick filters for “My voices” vs “Library”.
   - Clear filter affordance when no result matches.

4. **Make each option human-readable**
   - Display full voice name.
   - Show category/profession and tagline where available.
   - Show tone/style metadata in compact chips.
   - Avoid duplicate names defensively.

5. **Mobile-first interaction**
   - Use a tall scrollable picker with sticky search/filter controls.
   - Make rows large enough to tap comfortably.
   - Keep selected state obvious with a checkmark and selected label on the collapsed field.
   - Add loading and “adopting voice…” states so the user knows something is happening.

6. **Cache/invalidation**
   - Reuse existing `listVoiceProfiles`, `listSystemVoices`, and `adoptSystemVoice` server functions.
   - After adopting a library voice, invalidate voice queries so it appears under “My voices” too.

### Technical notes
- Primary file: `src/routes/_authenticated/settings.default-profiles.tsx`.
- Existing category labels can be reused from the Voice settings page.
- No database migration is needed for this UI fix.