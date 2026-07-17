## Theme-aware logo swap

Right now `TopBar.tsx` renders a single `askeve-logo.png` regardless of theme. On dark backgrounds the current mark reads poorly; the user uploaded a dark-optimized variant (`askeve-dark.png`) that should be shown whenever the resolved theme is dark.

### What to build

1. **Upload the dark logo as a CDN asset**
   - Run `lovable-assets create --file /mnt/user-uploads/askeve-dark.png --filename askeve-dark.png > src/assets/askeve-logo-dark.png.asset.json`.
   - Keep the existing `askeve-logo.png.asset.json` as the light-mode mark.

2. **Render the correct mark based on resolved theme**
   - In `src/components/shell/TopBar.tsx`, import both asset pointers.
   - Read the resolved theme from `ThemeProvider` (already exposes light/dark via the `.dark` class on `<html>`). Two viable approaches — pick one:
     - **CSS-only (preferred, no hydration flicker):** render both `<img>` tags and toggle visibility with Tailwind — `className="h-8 w-auto block dark:hidden"` for the light logo and `hidden dark:block` for the dark logo. Works with the pre-hydration theme boot script already in `src/lib/theme/theme.ts`.
     - **Hook-based:** consume the theme context and swap `src`. Slightly riskier during SSR because the resolved theme isn't known server-side.
   - Go with the CSS-only approach for reliability.

3. **Accessibility & polish**
   - Both `<img>` tags keep `alt="AskEve"`.
   - No layout change — same `h-8 w-auto` sizing.

### Files touched

- `src/assets/askeve-logo-dark.png.asset.json` (new, via CLI)
- `src/components/shell/TopBar.tsx` (render both, toggle with `dark:` variants)

### Out of scope

- No favicon change (favicon is a separate asset; ask if you want that too).
- No changes to `ThemeProvider` or the theme boot script.
