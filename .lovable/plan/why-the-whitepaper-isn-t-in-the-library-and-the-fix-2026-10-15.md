# Why the whitepaper isn't in the Library — and the fix

## What the logs and data show
- No errors in the app logs. The generation itself worked.
- The database has no new whitepaper. The only whitepaper on record is the old test draft "The Cost of Standing Still", and it is marked **archived**.
- The whitepaper you just generated was **never saved**. A draft is only written to the database when its name is confirmed. If that step is interrupted (page reload, navigation, or a quiet failure), everything on screen is lost — no draft, no Library entry.

## What we'll do

1. **Save the moment writing finishes.** As soon as a draft finishes generating, it is saved automatically with the suggested name — before asking you to confirm or rename it. Renaming later just updates the saved draft. Nothing on screen can be lost again.
2. **Make save failures visible.** If a save ever fails, you get a clear "Couldn't save — tap to retry" notice instead of silent loss.
3. **Hide archived items from the Library.** The Library currently doesn't filter out archived drafts (the old archived whitepaper can still surface). The General and Milestone views will exclude archived items; they stay reachable from Settings → Trash.

## Technical details
- `src/routes/_authenticated/create.$formatId.tsx`: move the `saveCreateDraft` call from the title-confirm handler to the stream-completion handler (title = suggested title); title confirm becomes a `renameDraft` call when the draft already has an id.
- Save errors surface via sonner toast with a retry action.
- `src/lib/library/library.functions.ts` (`searchDrafts`): add `.eq("archived", false)` to the base query.
- Verification: generate a whitepaper end to end signed in, confirm a new row appears in `create_drafts` (not archived) and shows in Library → General; confirm the old archived whitepaper no longer appears; clean build + tests.
