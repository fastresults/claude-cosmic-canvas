## Plan — Use Google Fonts "Inter" everywhere

Right now `src/styles.css` defines two families:

- `--font-display: "Instrument Serif"` (the serif you selected on "Hold to speak.")
- `--font-sans: "Inter Tight"` (body text)

Neither is currently loaded via `<link>`, so browsers fall back to system serif/sans. Swap both to Google Fonts **Inter** so the whole app uses one family, and every existing `font-display` / `font-sans` class picks it up with no component edits.

### Changes

1. **`src/routes/__root.tsx`** — add the Inter stylesheet to the root `head().links` (with `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`), per Tailwind v4 remote-font rules. Load a single weight range (`Inter:wght@400;500;600;700`) with `display=swap`.
2. **`src/styles.css`** — repoint both font tokens to Inter:
   - `--font-display: "Inter", ui-sans-serif, system-ui, sans-serif;`
   - `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;`
   - Leave the `.font-display { font-family: var(--font-display) }` utility in place; it now resolves to Inter, so every `font-display` heading (Domains, Hold to speak, 404, section titles) becomes Inter automatically.
3. **No component edits.** No hard-coded `Instrument Serif` / `Inter Tight` references exist outside `styles.css`, so a token swap covers the whole app.

### Verification

- Read the compiled CSS for `--font-display` to confirm Inter is applied.
- Load `/` and `/settings/domains` in Playwright, screenshot the `Hold to speak.` h1 and the `Domains` h1, and read `getComputedStyle(...).fontFamily` on both to confirm Inter is the resolved family.

### Files touched

- `src/routes/__root.tsx` — add `<link>`s to Google Fonts Inter.
- `src/styles.css` — repoint `--font-display` and `--font-sans` to `"Inter"`.

Nothing else changes.