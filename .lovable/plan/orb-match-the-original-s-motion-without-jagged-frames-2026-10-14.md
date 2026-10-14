# Orb: match the original's motion, without jagged frames

## Why it still flickers jagged
Comparing your original code with ours:
- **Hard edge cut:** the original trims the ring with a very narrow fade (`smoothstep(r0*1.05, r0, len)`). When the moving noise pushes the ring outward, that cut sweeps across pixels and shows as stair-steps for a moment.
- **Noise precision:** the noise uses a hash (`fract(p * 0.1031…)`) fed with ever-growing time. After a few minutes on the page, the numbers lose precision and the noise turns blocky, so the ring "chips".
- **Wave warp:** the hover/voice ripple bends the picture with a sharp 10x sine, which tears the edge.
- Our current version removed the noise to stay clean, so it no longer moves like yours.

## What changes
1. **Restore the original motion**: the flowing, breathing ring shape, the color sweep around it, and the bright light orbiting the ring, using your shader's structure and timings.
2. **Smooth every edge**: replace the narrow cut with a fade measured in screen pixels, so edges stay soft at any size and screen sharpness.
3. **Keep the noise stable over time**: loop time smoothly so noise never goes blocky, and lower the shape-wobble slightly so the ring stays round.
4. **Gentler voice reaction**: replace the sharp ripple with a soft, low-frequency swell, so speaking makes the orb breathe instead of tear.
5. Keep the fixes from last time: correct glow output (no dark disc), true sharpness on high-density screens, amber/violet palette, press/haptics, reduced motion, off-screen pause, no own microphone.

## Verify
Record about 20 frames over 10 seconds on a dark page at your screen size and sharpness, plus frames after jumping the clock forward by 30 minutes, and zoom in on the edges for stair-steps. Also capture a frame while the voice level is high.

## Technical details
- `VoicePoweredOrb.tsx` FRAG: reinstate `snoise3`/`light1`/`light2`/`v0`/`v1`/`v2`/`v3` from the upload. Replace `smoothstep(r0*1.05, r0, len)` with `smoothstep(r0 + 0.05 + px*2, r0, len)` where `px = 2.0/size`; widen v2/v3 edges by `px*2`. Noise amplitude range 0.4–0.6 → 0.45–0.55.
- Time: pass `iTime = (t*0.001) % 600` and drive noise with `vec3(uv*noiseScale, sin/cos loop)` so wrap is seamless; hash input stays small.
- Remove the `hover*sin(uv*10)` warp; map level to v1 intensity and radius swell (±0.03).
- Keep `gl_FragColor = vec4(col.rgb, col.a)` with blending disabled, ogl `dpr` capped at 2.
