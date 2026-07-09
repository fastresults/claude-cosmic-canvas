import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo, useState } from "react";

type OrbProps = {
  size?: number;
  idleOnly?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
};

/**
 * The Orb — Eve's primary interaction surface.
 * A living amber core wrapped in irregular breathing halos,
 * counter-rotating rings, orbiting sparks, and a turbulent wave field.
 */
export function Orb({ size = 200, idleOnly, onPress, onRelease }: OrbProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");

  // Deterministic per-instance spark config so remounts look consistent.
  const sparks = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => {
        const seed = i + 1;
        return {
          radius: 0.44 + ((seed * 13) % 11) / 100, // 0.44..0.55 of size
          duration: 7 + ((seed * 7) % 9), // 7..15s
          delay: (seed * 0.37) % 3,
          startAngle: (seed * 57) % 360,
          reverse: i % 2 === 0,
          size: 2 + (i % 3), // 2..4px
          hue: i % 3 === 0 ? "violet" : "amber",
        };
      }),
    [],
  );

  function handleDown() {
    if (idleOnly) return;
    setPressed(true);
    onPress?.();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(6);
    }
  }
  function handleUp() {
    if (idleOnly) return;
    if (!pressed) return;
    setPressed(false);
    onRelease?.();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }

  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const ringOuterR = s * 0.47;
  const ringInnerR = s * 0.4;
  const coreInset = s * 0.16;

  return (
    <button
      type="button"
      aria-label={idleOnly ? "Eve" : "Hold to speak"}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      className="relative touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ width: s, height: s }}
    >
      {/* Ambient outer glow — irregular breathing */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        animate={
          reduced
            ? { boxShadow: "0 0 40px 6px oklch(0.82 0.14 82 / 0.22)" }
            : {
                boxShadow: pressed
                  ? [
                      "0 0 50px 10px oklch(0.82 0.14 82 / 0.55)",
                      "0 0 90px 22px oklch(0.65 0.20 295 / 0.35)",
                      "0 0 60px 14px oklch(0.82 0.14 82 / 0.45)",
                      "0 0 50px 10px oklch(0.82 0.14 82 / 0.55)",
                    ]
                  : [
                      "0 0 30px 4px oklch(0.82 0.14 82 / 0.18)",
                      "0 0 55px 10px oklch(0.65 0.20 295 / 0.16)",
                      "0 0 40px 6px oklch(0.82 0.14 82 / 0.24)",
                      "0 0 30px 4px oklch(0.82 0.14 82 / 0.18)",
                    ],
              }
        }
        transition={{
          duration: pressed ? 2.3 : 7.1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* SVG field: turbulent wave halo + counter-rotating rings + sparks */}
      <svg
        aria-hidden
        viewBox={`0 0 ${s} ${s}`}
        className="pointer-events-none absolute inset-0"
        width={s}
        height={s}
      >
        <defs>
          <filter id={`orb-turb-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="2"
              seed="3"
            >
              {!reduced && (
                <animate
                  attributeName="baseFrequency"
                  dur={pressed ? "6s" : "14s"}
                  values="0.010;0.022;0.014;0.010"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale={s * 0.08} />
            <feGaussianBlur stdDeviation={s * 0.006} />
          </filter>
          <radialGradient id={`orb-ring-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0.7" />
          </radialGradient>
          <linearGradient id={`orb-stroke-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0.85" />
            <stop offset="50%" stopColor="oklch(0.65 0.20 295)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Turbulent wave halo */}
        <g filter={`url(#orb-turb-${uid})`} opacity={pressed ? 0.9 : 0.6}>
          <circle
            cx={cx}
            cy={cy}
            r={ringOuterR}
            fill="none"
            stroke={`url(#orb-ring-${uid})`}
            strokeWidth={s * 0.02}
          />
        </g>

        {/* Outer dashed ring — slow rotate */}
        <motion.g
          style={{ originX: "50%", originY: "50%" }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{
            duration: pressed ? 14 : 28,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={ringOuterR}
            fill="none"
            stroke={`url(#orb-stroke-${uid})`}
            strokeWidth={s * 0.008}
            strokeDasharray={`${s * 0.02} ${s * 0.04}`}
            opacity={0.7}
          />
        </motion.g>

        {/* Inner ring — counter rotate */}
        <motion.g
          style={{ originX: "50%", originY: "50%" }}
          animate={reduced ? undefined : { rotate: -360 }}
          transition={{
            duration: pressed ? 9 : 19,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={ringInnerR}
            fill="none"
            stroke="oklch(0.82 0.14 82 / 0.45)"
            strokeWidth={s * 0.006}
            strokeDasharray={`${s * 0.005} ${s * 0.03}`}
          />
        </motion.g>

        {/* Orbiting sparks */}
        {!reduced &&
          sparks.map((sp, i) => {
            const r = s * sp.radius;
            const rotateFrom = sp.startAngle;
            const rotateTo = sp.startAngle + (sp.reverse ? -360 : 360);
            return (
              <motion.g
                key={i}
                style={{ originX: "50%", originY: "50%" }}
                initial={{ rotate: rotateFrom }}
                animate={{ rotate: rotateTo }}
                transition={{
                  duration: pressed ? sp.duration * 0.55 : sp.duration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: sp.delay,
                }}
              >
                <circle
                  cx={cx}
                  cy={cy - r}
                  r={sp.size}
                  fill={
                    sp.hue === "violet"
                      ? "oklch(0.78 0.18 295 / 0.9)"
                      : "oklch(0.92 0.14 82 / 0.95)"
                  }
                  style={{
                    filter: `blur(${sp.size * 0.3}px) drop-shadow(0 0 ${
                      sp.size * 2
                    }px ${
                      sp.hue === "violet"
                        ? "oklch(0.65 0.20 295 / 0.7)"
                        : "oklch(0.82 0.14 82 / 0.8)"
                    })`,
                  }}
                />
              </motion.g>
            );
          })}
      </svg>

      {/* Core orb — liquid amber with drifting highlight */}
      <motion.span
        aria-hidden
        className="absolute rounded-full"
        style={{
          top: coreInset,
          left: coreInset,
          right: coreInset,
          bottom: coreInset,
          background:
            "radial-gradient(circle at 32% 28%, oklch(0.97 0.09 85) 0%, oklch(0.85 0.15 82) 38%, oklch(0.58 0.14 62) 82%, oklch(0.38 0.10 50) 100%)",
        }}
        animate={
          reduced
            ? { opacity: 0.95 }
            : {
                scale: pressed ? [1, 1.045, 0.995, 1.03, 1] : [1, 1.018, 0.995, 1.012, 1],
                filter: pressed
                  ? [
                      "brightness(1.05) saturate(1.15)",
                      "brightness(1.18) saturate(1.3)",
                      "brightness(1.08) saturate(1.2)",
                      "brightness(1.05) saturate(1.15)",
                    ]
                  : [
                      "brightness(1) saturate(1)",
                      "brightness(1.06) saturate(1.08)",
                      "brightness(0.98) saturate(1)",
                      "brightness(1) saturate(1)",
                    ],
              }
        }
        transition={{
          duration: pressed ? 2.7 : 5.3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Drifting inner highlight — irregular period vs core */}
      <motion.span
        aria-hidden
        className="absolute rounded-full mix-blend-screen"
        style={{
          top: coreInset,
          left: coreInset,
          right: coreInset,
          bottom: coreInset,
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.98 0.08 85 / 0.55) 0%, transparent 45%), radial-gradient(circle at 70% 75%, oklch(0.65 0.20 295 / 0.35) 0%, transparent 55%)",
        }}
        animate={
          reduced
            ? undefined
            : {
                backgroundPosition: [
                  "0% 0%, 100% 100%",
                  "20% 15%, 80% 85%",
                  "5% 10%, 95% 90%",
                  "0% 0%, 100% 100%",
                ],
                opacity: pressed ? [0.9, 1, 0.85, 0.95] : [0.7, 0.85, 0.65, 0.75],
              }
        }
        transition={{
          duration: pressed ? 3.1 : 11,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Specular rim */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          top: coreInset,
          left: coreInset,
          right: coreInset,
          bottom: coreInset,
          boxShadow:
            "inset 0 0 20px oklch(0.35 0.08 50 / 0.55), inset 0 2px 8px oklch(1 0.05 85 / 0.35)",
        }}
      />
    </button>
  );
}
