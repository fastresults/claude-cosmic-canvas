# Add global Light / Dark mode toggle

## Goal
Let the user switch between Dark (current) and Light themes, with a persistent preference and a global icon control. Dark stays the default so nothing changes for existing users until they opt in.

## 1. Design tokens — add a Light palette
`src/styles.css`

- Keep current `:root` values as the Dark theme, but move them under both `:root` and `.dark` so `.dark` explicitly wins when toggling.
- Add a `.light` block overriding every semantic token with a warm-paper Light palette that keeps the Eve identity (amber primary, violet accent-2, same radii, same brain colors):
  - `--background`: near-white warm paper (oklch ~0.98 0.01 85)
  - `--surface` / `--surface-elev`: soft cream layers
  - `--foreground`: deep plum-ink (oklch ~0.18 0.03 285)
  - `--muted-foreground`: mid warm grey
  - `--border` / `--input`: dark-on-light at low alpha
  - `--primary` / `--accent`: same amber, but `--primary-foreground` flips to deep ink for contrast on amber buttons
  - `--destructive`, `--success`, `--accent-2`, brain colors: retuned for AA contrast on light
- Update `html { color-scheme }` and the `::selection` rule to react to the active class (use `:where(.dark)` / `:where(.light)`).
- Tune `.frosted` and `.amber-glow` so they still read on a light background (lower blur opacity mix, softer glow).
- Remove the "Force dark; no light theme in v1" comment.

## 2. Theme runtime
New file `src/lib/theme/theme.ts` — tiny framework-agnostic helper:

- `type Theme = "light" | "dark" | "system"`
- `getStoredTheme()`, `setStoredTheme(t)` using `localStorage` key `eve-theme`
- `resolveTheme(t)` → `"light" | "dark"` (reads `matchMedia('(prefers-color-scheme: light)')` for `system`)
- `applyTheme(t)` → toggles `.dark` / `.light` on `<html>` and sets `color-scheme`
- SSR-safe: all `window`/`document` access guarded

New file `src/lib/theme/ThemeProvider.tsx`:

- React context exposing `{ theme, resolved, setTheme }`
- On mount, reads stored theme (default `"system"`), applies it, subscribes to `matchMedia` changes when in system mode
- `useTheme()` hook

## 3. Prevent flash of wrong theme
`src/routes/__root.tsx`

- Remove hardcoded `className="dark"` on `<html>`.
- Inject a tiny blocking inline script in `<head>` (via TanStack `Scripts`/`HeadContent` — add a raw `<script>` before `<Scripts />` in `RootShell`) that reads `localStorage.eve-theme` (or system) and sets the correct class on `document.documentElement` before first paint.
- Wrap `<Outlet />` in `<ThemeProvider>` inside `RootComponent`.
- Update `<meta name="theme-color">` to switch based on resolved theme (two `<meta>` tags with `media="(prefers-color-scheme: light)"` and `"(prefers-color-scheme: dark)"`), plus a runtime update when user picks a non-system value.

## 4. Global icon control
New file `src/components/shell/ThemeToggle.tsx`

- Small icon button (Sun / Moon / Monitor from `lucide-react`) matching the TopBar's existing icon-button styling (`rounded-full p-1.5 text-muted-foreground hover:bg-surface-elev hover:text-foreground`, `h-4 w-4` icon).
- Behavior: single tap cycles `system → light → dark → system`. Long-press / right-click is not needed for v1.
- `aria-label` reflects current state, e.g. "Theme: dark, tap to switch to system".
- Icon: shows Sun in light, Moon in dark, Monitor in system.

Mount in `src/components/shell/TopBar.tsx` between the streak pill and the Bell — one line, no layout reshuffle. This surfaces the toggle on every authenticated screen without hunting through settings.

Also expose it in Settings for discoverability: add a small "Appearance" row to `src/routes/_authenticated/settings.index.tsx` (icon: `SunMoon`, hint: "Light or dark theme") that opens a new lightweight route `src/routes/_authenticated/settings.appearance.tsx` with three radio cards: System / Light / Dark.

## 5. Component sweep (contrast fixes only)
Grep for hardcoded color utilities that would break in light mode and swap to semantic tokens where they exist:

- `text-white`, `bg-black`, `bg-white`, `text-black` under `src/components/**` and `src/routes/**`.
- Any `bg-[#...]` / `text-[#...]` in shell, drafts, brain views, workspaces.

Only fix violations that visibly break light mode. Do not restyle. Three.js brain colors in `src/components/brain/three/palette.ts` stay as-is (hex is required for three), but verify the starfield and canvas background read on light — if not, gate the canvas background color on `document.documentElement.classList.contains('light')` via the existing scene setup.

## 6. Out of scope
- No changes to auth flow, data model, or server functions.
- No per-workspace theme overrides.
- No custom brand-theming beyond Light/Dark.
- Onboarding does not gain a theme step in this pass.

## Technical notes
- Storage key: `eve-theme`. Values: `"light" | "dark" | "system"`. Default: `"system"`.
- Class strategy over `data-theme` because the codebase already relies on Tailwind's `dark:` variant (`html.dark`); adding `.light` is additive.
- The pre-hydration inline script is the standard fix for flash-of-wrong-theme; without it, users see a Dark→Light flicker on first load.
- Provider is client-only (`useEffect` for `matchMedia` subscription); the inline script handles SSR correctness.

## Files touched
- `src/styles.css` — add `.light` palette, adjust utilities
- `src/routes/__root.tsx` — remove hardcoded `dark`, add pre-hydration script, wrap in provider, dual theme-color meta
- `src/components/shell/TopBar.tsx` — mount `<ThemeToggle />`
- `src/components/shell/ThemeToggle.tsx` — new
- `src/lib/theme/theme.ts` — new
- `src/lib/theme/ThemeProvider.tsx` — new
- `src/routes/_authenticated/settings.index.tsx` — add Appearance row
- `src/routes/_authenticated/settings.appearance.tsx` — new
- `public/manifest.webmanifest` — leave `theme_color` as dark (PWA install color); runtime meta handles browser chrome
- Targeted contrast fixes in components using hardcoded colors
