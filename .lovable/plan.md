# Orb in light mode: a jewel on paper, not a smudge

## What's wrong in light mode (from your screenshot)
- The orb is designed to **give off light** on a dark screen. Its glow is drawn as "light added to black". On cream paper, the dim parts of that glow come out as a **grey, smoky haze** around the ring, so it looks dirty.
- The deep-indigo shading that adds depth on dark backgrounds turns muddy grey on light ones.
- The pale amber and lilac tones are too light to stand out against cream, so the ring looks washed out.
- The faint outline drawn before the orb loads makes the ring look like it has a halo of dust.
- One frame in your screenshot still shows a seam at the top left. That's the old version; the seam fix from last time is in, so a hard reload clears it.

## Recommendation (mobile UI senior designer view)
Don't make the dark-mode orb share one look with light mode. Give the orb a **light-mode look** with the same motion, shape, and identity:

- **Glows like colored glass, not light.** In light mode the glow is drawn as **tinted color with no grey**. The halo fades from saturated amber or violet straight to transparent, the way a tinted glass ring casts color on paper.
- **Deeper tones for contrast.** Use richer amber (honey) and a deeper violet, so the ring reads clearly against cream. This matches the light theme's existing deep-ink accents and gives enough contrast for outdoor phone use in sunlight.
- **Clean paper center.** The middle stays the page color with no tinted disc.
- **A soft lift.** A very faint warm shadow under the orb grounds it on the page, the way iOS lifts its key controls. It's the only cue in place of the glow.
- **Same feel everywhere.** Same breathing, color sweep, circling highlight, voice reaction, press haptics, and reduced-motion behavior. Switching themes cross-fades smoothly instead of popping.

Result: in dark mode it glows; in light mode it looks like a tinted glass ring. Both read as the same orb.

## Verify
Capture frames over about 10 seconds in light and dark mode at your screen size and sharpness, plus one while switching themes. Zoom in to check there's no grey haze, no seams, and that the ring has clear contrast on cream.

## Technical details
- `VoicePoweredOrb.tsx`: new `uLight` uniform (0..1, eased over ~400ms when the theme changes). Theme read from `useTheme()` resolved value (or the `html.light` class, watched with a MutationObserver as a fallback).
- Light branch in the fragment shader: palette amber `oklch(0.72 0.16 70)`, violet `oklch(0.55 0.22 295)`; skip the `color3` dark mix (mix toward the ring color instead); alpha = `clamp(intensity)` with rgb = the unnormalized saturated color (straight alpha, blending off as now), so faint glow is transparent-tinted, never grey. Light mode slightly reduces the outer halo strength and keeps the core line crisp.
- `Orb.tsx`: hide the fallback outline in light mode (or swap it for a faint violet stroke); add a light-only soft shadow (`drop-shadow` filter on the wrapper, using a theme token added to `src/styles.css`, e.g. `--orb-lift`). Dark mode unchanged.
