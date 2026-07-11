## Audit findings

1. **The selected style is not part of concept generation.** Concepts are generated from draft context only, then the UI prepends the selected style later. That means concept ideas can conflict with the style template the user picked.

2. **The final image prompt is composed on the client.** The image API receives a flat prompt string, so the backend cannot guarantee it contains the current draft, role, selected style, audience, domain, and generation constraints.

3. **Custom prompts bypass article grounding.** When the user types a custom prompt, it replaces the article context instead of being treated as additional direction for the article-based image.

4. **Fallback concepts are too generic.** If grounding times out or fails, the app falls back to title-only prompts, which can easily produce images disconnected from the article.

5. **Saved prompt metadata is incomplete.** Attached images save the user-facing concept prompt, not the fully composed prompt/style/context that actually generated the image, making debugging and rerolling unreliable.

6. **Runtime logs did not show a recent failed image request.** Console/network snapshots and AI Gateway logs showed no recent matching requests, so this looks like a prompt/control-flow quality issue rather than a transport failure.

## Plan

### 1. Make image generation server-owned and article-grounded
- Update `/api/drafts/generate-image` to accept structured input:
  - `draftId`
  - `role` (`cover`, `social`, `inline`)
  - `styleId`
  - `conceptPrompt` or `customDirection`
  - `aspect`
- In the route, verify the user, load the draft and selected style from the backend, then build the final image prompt server-side.
- The final prompt will always include:
  - title
  - article summary/key claims
  - format/platform
  - domain/audience
  - role-specific image purpose
  - selected style name, description, prompt prefix, negative prompt
  - user concept/custom direction as a constraint, not a replacement

### 2. Make concept generation style-aware
- Extend `generateImageConcepts` to accept `styleId`.
- Load the selected style in the server function before asking the model for concepts.
- Ask for concepts that fit both:
  - the article’s actual message
  - the selected visual template
- When the user changes the style template, regenerate/reload the concept list for that style instead of reusing stale concepts from another style.

### 3. Add explicit mobile-first controls in the generate sheet
- Keep style templates as the first control.
- Add a clear selected-style state and a “Regenerate ideas” action when style changes.
- Rename the custom prompt field to behave like direction, e.g. “Add extra direction…” so it does not imply replacing the article context.
- Show a compact “Grounded from this draft” summary/check so users can trust the image is tied to the article.

### 4. Improve fallback behavior
- Replace title-only fallback prompts with deterministic prompts built from the draft title plus first meaningful article paragraphs.
- Use role-specific fallbacks:
  - cover: broad editorial visual metaphor
  - social: thumb-stopping square/mobile composition
  - inline: specific supporting visual for a key point
- Still apply the selected style prefix and negative prompt.

### 5. Save generation provenance accurately
- When attaching an image, save the full composed generation prompt and style id/snapshot into `create_media.meta` or existing prompt fields.
- Keep the shorter concept prompt visible in the UI, but store enough metadata for rerolls/debugging.

### 6. Verify the full flow
- Test cover, social, and inline generation from the draft detail sheet.
- Confirm that changing the style changes both the generated concepts and the final prompt sent to image generation.
- Confirm custom direction still includes article context.
- Confirm attached media stores the selected style and final prompt metadata.