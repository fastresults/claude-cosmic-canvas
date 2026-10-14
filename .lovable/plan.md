# Fix the orb: clean, smooth rotating ring

## What's wrong today
- The ring's edge wobbles and looks jagged because its radius is driven by moving noise, plus a "hover" wave distortion warps the edge further.
- A dark disc (the button's backing) and the brown amber fallback core sit behind the ring, so the glow looks clipped and muddy instead of floating.
- The canvas is sized twice for high-density screens, which can soften/step the edge.

## Target (your reference)
A perfectly round, thin, bright ring with a soft outer halo, a clean dark center, and a smooth light highlight that sweeps around the circle. Colors kept in the app palette (amber to violet).

## Changes
1. Rewrite the shader as a clean ring:
   - Fixed radius (no noise on the shape). Edge drawn with smooth anti-aliased falloff based on pixel size, so it's crisp at any size.
   - Thin bright core line + wide soft outer glow + faint inner glow fading to a clean center.
   - Color gradient around the ring (amber to violet) that slowly rotates; a brighter highlight arc travels around it.
   - Voice level only changes glow brightness/thickness slightly — never the shape.
2. Remove the hover wave distortion entirely.
3. Remove the dark backing disc and make the amber fallback a faint ring (not a filled brown circle), fading out once the orb paints.
4. Fix the double sizing so the canvas renders at true screen sharpness.
5. Keep everything else: press/haptics, reduced motion (static ring), off-screen pause, no own microphone.

## Verify
Screenshot the home page at retina density, zoom on the edge to confirm a smooth circle; compare against the reference; check no errors.

## Technical details
- `VoicePoweredOrb.tsx`: new fragment shader using `fwidth`-style AA via `1.5/size` px width; `ring = exp(-abs(len-R)*k)`; hue from `atan` + `iTime*rot`; drop `snoise3`, hover uniforms. Use ogl `dpr` option only, call `renderer.setSize(width, height)`.
- `Orb.tsx`: remove backing bg class; fallback span becomes a border ring.
