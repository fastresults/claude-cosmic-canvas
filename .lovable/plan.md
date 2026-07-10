## Plan: hard-audit and fix Draft → Generate Image → Save to Card

### What I found
- The style templates are present and seeded correctly, including preview images.
- No recent image-generation requests reached the AI Gateway, which means the stuck UI is most likely happening before the actual image render call.
- The visible stuck label, “Grounding concepts from your draft…”, belongs to the concept-generation server function, not the image renderer.
- The current UI waits for AI-generated concepts before showing the user any actionable prompt cards, so if concept grounding hangs or never resolves, the user cannot reach completed image generation.
- The image route currently forwards the stream but has minimal instrumentation, no timeout, and no robust fallback path if the upstream stream never produces `image_generation.completed`.
- Generated images are only uploaded and attached after the user manually taps “Attach to draft”; there is no durable in-progress record, so failures can leave no media row and no obvious recovery state.

### Fix approach
1. **Instrument the workflow with safe logs**
   - Add server-side logs for: concept grounding start/success/fallback/failure, image stream start/upstream status/completed/error, upload/attach success/failure.
   - Never log full prompts, image payloads, auth tokens, or signed URLs.

2. **Unblock the UI from concept grounding**
   - Add a timeout around `generateImageConcepts` so “Grounding concepts…” cannot spin forever.
   - If grounding times out or fails, show deterministic fallback concepts immediately.
   - Keep the custom prompt box usable while concepts are loading.
   - Add retry and error copy for concept grounding instead of an endless loader.

3. **Make style-template selection generate directly**
   - Ensure style templates are not just decorative: selecting a style plus a concept/custom prompt composes a final prompt and calls `/api/drafts/generate-image`.
   - Persist the selected `styleId`, aspect ratio, original prompt, and provider metadata on attach.

4. **Harden streaming image generation**
   - Update the server route to use the project’s existing Lovable AI Gateway helper/header pattern for raw image generation.
   - Add request validation, safe error responses, and timeout/abort handling so the UI exits with a clear error instead of hanging.
   - Keep SSE pass-through for progressive rendering and ensure the client treats an ended stream without `image_generation.completed` as a failure.

5. **Improve client state machine**
   - Explicit states: `grounding`, `ready`, `rendering`, `rendered`, `attaching`, `attached`, `failed`.
   - Disable only actions that truly cannot run; do not block custom generation on concept loading.
   - Surface errors inline with retry/back controls.
   - Prevent double submits during render/attach.

6. **Guarantee save/attach behavior**
   - After a final image frame arrives, upload it to the `draft-media` storage bucket.
   - Then create the `create_media` row through the existing authenticated server function.
   - If upload succeeds but attach fails, show a recoverable attach error and keep the preview visible so the user can retry.
   - Invalidate draft image queries after successful attach so the card updates immediately.

7. **Verify end-to-end**
   - Use the live preview workflow on mobile viewport: open draft image sheet, select a style, generate image, wait for final frame, attach to draft.
   - Confirm a new `create_media` row exists with the expected `draft_id`, `role`, `style_id`, provider, aspect ratio, and URL.
   - Check logs to confirm the request reached the AI Gateway and ended in a completed or surfaced error state.
