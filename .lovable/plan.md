# Tap-to-peek, tap-again-to-select for thumbnails (mobile-first)

## Interaction model (revised)

**Mobile / touch (primary)** — two-tap commit:
1. **First tap** on a thumbnail → opens a magnified **Peek overlay**. Nothing is selected yet. The underlying tile shows a subtle "previewing" ring so the user knows what they just tapped.
2. **Second tap** while the overlay is open → commits selection and closes the overlay. The second tap can land either on the enlarged image itself or on an explicit **"Use this"** button pinned inside the overlay (both do the same thing, so users who want the button always have it, and users who just tap the image again get the fast path).
3. Tapping the **backdrop**, the **✕**, pressing **Esc**, or **swiping down** closes the overlay without selecting.

**Desktop / pointer:fine** — hover to peek, click to select:
- Hover a thumbnail (150 ms intent delay) → opens the same Peek overlay, non-modal, no selection.
- Click the thumbnail (or the "Use this" button in the overlay) → selects immediately and closes the overlay.
- Mouse-leave closes the overlay.

**Rationale**: on mobile, tap-to-select would fire the moment the user tries to look closer — exactly the problem the user flagged. Splitting *look* from *choose* gives a safe preview step, and putting the confirm action on both the image and a button keeps the second tap fast without hiding the choice.

## Surfaces in scope
1. `ImageAssociationSheet` → **Style Template strip** (Editorial/Magazine/Documentary tiles from the screenshot).
2. `ImageAssociationSheet` → **Library tab** grid — selection now means "pick this image to attach", so the confirm button in the overlay reads **"Attach to draft"** and calls the existing attach mutation.
3. `DraftDetailSheet` → cover / social / inline image grids — no selection semantics; overlay is view-only and replaces the ad-hoc lightbox added last turn.
4. `DraftCard` covers (`components/drafts/DraftCard.tsx`, `components/primitives/DraftCard.tsx`) — first tap peeks the cover, second tap (or "Open draft" button) opens the draft sheet.
5. `ImageAssociationSheet` generated preview stays as-is (it is already the large view).

## New shared component
`src/components/primitives/ThumbPeek.tsx`
- Props: `src`, `alt`, `label?`, `selected?`, `confirmLabel?` (default `"Use this"`), `onConfirm()`, `aspect?`, `children` (tile chrome).
- Detects pointer type via `matchMedia('(hover: hover) and (pointer: fine)')`.
  - Touch: click on tile → open overlay only. Click on overlay image or confirm button → `onConfirm()` + close.
  - Pointer: hover-intent opens overlay; click anywhere on tile or confirm button → `onConfirm()` immediately.
- Overlay: portal, centered card up to `min(92vw, 720px)`, image at natural aspect, caption row with `label`, primary "Use this / Attach to draft" button, secondary "Cancel" button. Backdrop click, Esc, and swipe-down dismiss.
- Applies `previewing` ring to the tile while its overlay is open, `selected` ring when `selected` is true.
- Focus trap when opened by tap; respects `prefers-reduced-motion` (fade, no scale).
- Announces state via `aria-live` ("Previewing X. Tap image again to select.").

## Wiring
- **Style strip**: replace the current `<button>` tile with `<ThumbPeek onConfirm={() => setStyleId(s.styleId)} selected={styleId===s.styleId} label={s.name} confirmLabel="Use this style" …>`. Uses a real `<img>` so the overlay reuses the same URL.
- **Library grid**: `<ThumbPeek onConfirm={() => attach.mutate({ role, url: it.url, prompt: it.prompt ?? undefined, generatedBy: "library" })} confirmLabel="Attach to draft" …>`. Removes the current "tap = immediate attach" behavior, which is unsafe now that tap also opens the peek.
- **DraftDetailSheet image rows**: `<ThumbPeek onConfirm={() => {}} confirmLabel={undefined} …>`; when `confirmLabel` is undefined the overlay hides the confirm button and behaves as view-only (matches the existing lightbox behavior).
- **DraftCard covers**: `<ThumbPeek onConfirm={openDraft} confirmLabel="Open draft" …>`.

## Out of scope
- Style-tile selection still does NOT auto-run generation; the user still picks a concept card or presses Generate.
- No backend, data-model, or generation-pipeline changes.
- No visual redesign beyond the overlay shell and selection ring.

## Verification (Playwright, 390×844 and 1280×1800)
- Mobile: tap a style tile → overlay opens, no `styleId` change yet. Tap the enlarged image → `styleId` updates, overlay closes. Repeat with the "Use this style" button. Repeat on a library thumbnail → confirms attach only on second tap.
- Mobile: tap a style tile, tap backdrop → overlay closes, `styleId` unchanged.
- Desktop: hover a style tile → overlay opens without selection change. Click the tile → selects immediately.
- Reduced motion: overlay fades in, no scale.
- DraftDetailSheet: tapping a cover/social/inline thumb still just opens the large view, no confirm button visible.
