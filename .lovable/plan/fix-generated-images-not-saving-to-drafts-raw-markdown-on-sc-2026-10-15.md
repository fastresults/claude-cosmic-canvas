# Fix: generated images not saving to drafts + raw Markdown on screen

## What the logs show
- The image was generated (01:00 UTC, 18s, success), but nothing ever asked to attach it to the draft. The newest saved draft image in the database is from July.
- An image only gets saved when you click the confirm button in the image panel after it finishes. If the panel closes, you navigate away, or you miss the button, the image is thrown away without any warning.
- Raw Markdown shows up in two places:
  - The "Grounded from draft:" note in the image panel shows raw text (for example `**Start with a purpose...`).
  - Library card previews show the first 140 characters of the draft body as raw text, so symbols like `##`, `**` and `>` show up.

## Changes
1. **Images save automatically.** As soon as an image finishes generating, it's uploaded and attached to the draft as the cover/social/inline image. You'll see a "Saved to draft" notice. The confirm button becomes "Done", and "Regenerate" replaces the image you just saved.
2. **No silent loss.** If uploading or attaching fails, you get a clear notice with a Retry button. If you close the panel while an image is still generating, the app asks you to confirm first (using an in-app dialog).
3. **Readable previews.** Library card previews and the "Grounded from draft" note show clean text, with the Markdown symbols removed (headings, bold, quotes, list markers, links).
4. **Check for other spots.** Find any other screen that cuts a short preview from a draft body (drafts list, workspace items, search results) and apply the same cleanup.

## Verification
- Signed in, generate a cover image on a draft. Without clicking anything else, confirm it shows on the draft and in the database, and still shows after a reload.
- Library → General: card previews show no `#`, `*` or `>` symbols, in both light and dark mode.

## Technical details
- `ImageAssociationSheet.tsx`: in `run()`, once `streamDraftImage` resolves with the final frame, call the existing `confirm()` logic (`uploadDataUrl` and then `attach.mutateAsync`), keep the attached image's id so Regenerate can pass it as `parentImageId` or replace it, add a sonner toast for success and failure, and add a `useConfirm` guard on close while streaming.
- New `src/lib/text/plain-preview.ts` with `toPlainPreview(md, max)`: strips Markdown syntax and collapses whitespace. Use it in `library.tsx` (lines ~541/546), at both `groundedSummary` render sites, and at the other preview sites found by searching for `.body.replace(` / `.slice(0,`.
- Add a unit test for `toPlainPreview` in `src/lib/text/__tests__/`.
