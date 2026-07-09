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
 * A shape-shifting amber plasma: morphing blob core, chromatic pulses,
 * warping halos, counter-rotating rings, orbiting sparks, turbulent field.
 */
export function Orb({ size = 200, idleOnly, onPress, onRelease }: OrbProps) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const uid = useId().replace(/[:]/g, "");

  const sparks = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const seed = i + 1;
        return {
          radius: 0.42 + ((seed * 17) % 14) / 100, // 0.42..0.55
          duration: 6 + ((seed * 7) % 10),
          delay: (seed * 0.37) % 3,
          startAngle: (seed * 51) % 360,
          reverse: i % 2 === 0,
          size: 2 + (i % 3),
          hue: i % 3 === 0 ? "violet" : i % 3 === 1 ? "amber" : "rose",
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

  // Wild morphing border-radius sequences — asymmetric blobs.
  const blobIdle = [
    "58% 42% 63% 37% / 52% 48% 52% 48%",
    "42% 58% 37% 63% / 63% 37% 58% 42%",
    "67% 33% 46% 54% / 39% 61% 44% 56%",
    "35% 65% 58% 42% / 55% 45% 65% 35%",
    "50% 50% 50% 50% / 50% 50% 50% 50%",
    "58% 42% 63% 37% / 52% 48% 52% 48%",
  ];
  const blobPressed = [
    "70% 30% 40% 60% / 40% 70% 30% 60%",
    "30% 70% 65% 35% / 65% 30% 70% 35%",
    "55% 45% 30% 70% / 30% 60% 40% 70%",
    "72% 28% 58% 42% / 45% 72% 28% 55%",
    "40% 60% 72% 28% / 60% 40% 55% 45%",
    "70% 30% 40% 60% / 40% 70% 30% 60%",
  ];

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
      {/* Ambient outer glow — chromatic pulse cycling amber → violet → rose */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        animate={
          reduced
            ? { boxShadow: "0 0 40px 6px oklch(0.82 0.14 82 / 0.22)" }
            : {
                boxShadow: pressed
                  ? [
                      "0 0 60px 14px oklch(0.82 0.14 82 / 0.6), 0 0 120px 30px oklch(0.65 0.20 295 / 0.25)",
                      "0 0 90px 24px oklch(0.65 0.20 295 / 0.55), 0 0 140px 40px oklch(0.74 0.17 355 / 0.25)",
                      "0 0 70px 18px oklch(0.74 0.17 355 / 0.5), 0 0 130px 35px oklch(0.82 0.14 82 / 0.3)",
                      "0 0 100px 28px oklch(0.82 0.14 82 / 0.55), 0 0 150px 45px oklch(0.65 0.20 295 / 0.3)",
                      "0 0 60px 14px oklch(0.82 0.14 82 / 0.6), 0 0 120px 30px oklch(0.65 0.20 295 / 0.25)",
                    ]
                  : [
                      "0 0 30px 4px oklch(0.82 0.14 82 / 0.22), 0 0 80px 16px oklch(0.65 0.20 295 / 0.12)",
                      "0 0 60px 12px oklch(0.65 0.20 295 / 0.28), 0 0 110px 26px oklch(0.82 0.14 82 / 0.14)",
                      "0 0 45px 8px oklch(0.74 0.17 355 / 0.22), 0 0 90px 20px oklch(0.82 0.14 82 / 0.18)",
                      "0 0 70px 16px oklch(0.82 0.14 82 / 0.3), 0 0 120px 30px oklch(0.65 0.20 295 / 0.15)",
                      "0 0 30px 4px oklch(0.82 0.14 82 / 0.22), 0 0 80px 16px oklch(0.65 0.20 295 / 0.12)",
                    ],
              }
        }
        transition={{
          duration: pressed ? 3.3 : 8.7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Warping blob halo — outer plasma envelope, morphs shape + rotates */}
      <motion.span
        aria-hidden
        className="absolute"
        style={{
          top: -s * 0.06,
          left: -s * 0.06,
          right: -s * 0.06,
          bottom: -s * 0.06,
          background:
            "radial-gradient(circle at 40% 40%, oklch(0.82 0.14 82 / 0.35) 0%, oklch(0.65 0.20 295 / 0.2) 50%, transparent 75%)",
          filter: `blur(${s * 0.04}px)`,
        }}
        animate={
          reduced
            ? { borderRadius: "50%" }
            : {
                borderRadius: pressed ? blobPressed : blobIdle,
                rotate: pressed ? [0, 45, -30, 60, 0] : [0, 20, -15, 25, 0],
                scale: pressed
                  ? [1, 1.12, 0.94, 1.08, 1]
                  : [1, 1.05, 0.97, 1.03, 1],
              }
        }
        transition={{
          duration: pressed ? 4.7 : 11,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* SVG field: turbulent wave + counter-rotating rings + sparks */}
      <svg
        aria-hidden
        viewBox={`0 0 ${s} ${s}`}
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={s}
        height={s}
      >
        <defs>
          <filter
            id={`orb-turb-${uid}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014"
              numOctaves="3"
              seed="3"
            >
              {!reduced && (
                <animate
                  attributeName="baseFrequency"
                  dur={pressed ? "4.5s" : "10s"}
                  values="0.008;0.030;0.014;0.024;0.008"
                  repeatCount="indefinite"
                />
              )}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale={s * (pressed ? 0.16 : 0.11)} />
            <feGaussianBlur stdDeviation={s * 0.008} />
          </filter>
          <radialGradient id={`orb-ring-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0.75" />
          </radialGradient>
          <linearGradient
            id={`orb-stroke-${uid}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="oklch(0.82 0.14 82)" stopOpacity="0.9" />
            <stop offset="50%" stopColor="oklch(0.65 0.20 295)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.74 0.17 355)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Turbulent wave halo — warps and breathes */}
        <motion.g
          filter={`url(#orb-turb-${uid})`}
          style={{ originX: "50%", originY: "50%" }}
          animate={
            reduced
              ? { opacity: 0.5 }
              : {
                  opacity: pressed ? [0.7, 1, 0.75, 0.95, 0.7] : [0.45, 0.75, 0.5, 0.7, 0.45],
                  scale: pressed ? [1, 1.14, 0.92, 1.08, 1] : [1, 1.06, 0.96, 1.04, 1],
                  rotate: pressed ? [0, 25, -20, 15, 0] : [0, 12, -8, 6, 0],
                }
          }
          transition={{
            duration: pressed ? 3.7 : 9.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={ringOuterR}
            fill="none"
            stroke={`url(#orb-ring-${uid})`}
            strokeWidth={s * 0.024}
          />
          <circle
            cx={cx}
            cy={cy}
            r={ringOuterR * 0.82}
            fill="none"
            stroke="oklch(0.65 0.20 295 / 0.5)"
            strokeWidth={s * 0.012}
          />
        </motion.g>

        {/* Outer dashed ring — rotates + warps into ellipse */}
        <motion.g
          style={{ originX: "50%", originY: "50%" }}
          animate={
            reduced
              ? undefined
              : {
                  rotate: 360,
                  scaleX: pressed ? [1, 1.12, 0.92, 1.06, 1] : [1, 1.06, 0.96, 1.03, 1],
                  scaleY: pressed ? [1, 0.9, 1.1, 0.96, 1] : [1, 0.96, 1.04, 0.98, 1],
                }
          }
          transition={{
            rotate: {
              duration: pressed ? 11 : 26,
              repeat: Infinity,
              ease: "linear",
            },
            scaleX: {
              duration: pressed ? 3.9 : 8.5,
              repeat: Infinity,
              ease: "easeInOut",
            },
            scaleY: {
              duration: pressed ? 4.3 : 9.7,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={ringOuterR}
            fill="none"
            stroke={`url(#orb-stroke-${uid})`}
            strokeWidth={s * 0.009}
            strokeDasharray={`${s * 0.022} ${s * 0.045}`}
            opacity={0.8}
          />
        </motion.g>

        {/* Inner ring — counter rotate + squash */}
        <motion.g
          style={{ originX: "50%", originY: "50%" }}
          animate={
            reduced
              ? undefined
              : {
                  rotate: -360,
                  scaleX: pressed ? [1, 0.88, 1.14, 0.94, 1] : [1, 0.94, 1.06, 0.97, 1],
                  scaleY: pressed ? [1, 1.14, 0.9, 1.06, 1] : [1, 1.06, 0.94, 1.03, 1],
                }
          }
          transition={{
            rotate: {
              duration: pressed ? 7 : 17,
              repeat: Infinity,
              ease: "linear",
            },
            scaleX: {
              duration: pressed ? 3.1 : 7.3,
              repeat: Infinity,
              ease: "easeInOut",
            },
            scaleY: {
              duration: pressed ? 3.5 : 8.1,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={ringInnerR}
            fill="none"
            stroke="oklch(0.82 0.14 82 / 0.5)"
            strokeWidth={s * 0.007}
            strokeDasharray={`${s * 0.006} ${s * 0.032}`}
          />
        </motion.g>

        {/* Orbiting sparks */}
        {!reduced &&
          sparks.map((sp, i) => {
            const r = s * sp.radius;
            const rotateFrom = sp.startAngle;
            const rotateTo = sp.startAngle + (sp.reverse ? -360 : 360);
            const fill =
              sp.hue === "violet"
                ? "oklch(0.78 0.18 295 / 0.95)"
                : sp.hue === "rose"
                  ? "oklch(0.80 0.17 355 / 0.9)"
                  : "oklch(0.92 0.14 82 / 0.95)";
            const shadow =
              sp.hue === "violet"
                ? "oklch(0.65 0.20 295 / 0.8)"
                : sp.hue === "rose"
                  ? "oklch(0.74 0.17 355 / 0.75)"
                  : "oklch(0.82 0.14 82 / 0.85)";
            return (
              <motion.g
                key={i}
                style={{ originX: "50%", originY: "50%" }}
                initial={{ rotate: rotateFrom }}
                animate={{ rotate: rotateTo }}
                transition={{
                  duration: pressed ? sp.duration * 0.5 : sp.duration,
                  repeat: Infinity,
                  ease: "linear",
                  delay: sp.delay,
                }}
              >
                <circle
                  cx={cx}
                  cy={cy - r}
                  r={sp.size}
                  fill={fill}
                  style={{
                    filter: `blur(${sp.size * 0.3}px) drop-shadow(0 0 ${
                      sp.size * 2.5
                    }px ${shadow})`,
                  }}
                />
              </motion.g>
            );
          })}
      </svg>

      {/* Core plasma — morphing blob with drifting hue */}
      <motion.span
        aria-hidden
        className="absolute"
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
            ? { borderRadius: "50%", opacity: 0.95 }
            : {
                borderRadius: pressed ? blobPressed : blobIdle,
                rotate: pressed ? [0, 40, -25, 30, 0] : [0, 15, -10, 20, 0],
                scale: pressed
                  ? [1, 1.06, 0.93, 1.05, 1]
                  : [1, 1.025, 0.985, 1.02, 1],
                filter: pressed
                  ? [
                      "brightness(1.05) saturate(1.2) hue-rotate(0deg)",
                      "brightness(1.22) saturate(1.4) hue-rotate(-15deg)",
                      "brightness(1.1) saturate(1.3) hue-rotate(20deg)",
                      "brightness(1.18) saturate(1.35) hue-rotate(-8deg)",
                      "brightness(1.05) saturate(1.2) hue-rotate(0deg)",
                    ]
                  : [
                      "brightness(1) saturate(1) hue-rotate(0deg)",
                      "brightness(1.08) saturate(1.12) hue-rotate(-8deg)",
                      "brightness(0.96) saturate(1.05) hue-rotate(12deg)",
                      "brightness(1.05) saturate(1.1) hue-rotate(-4deg)",
                      "brightness(1) saturate(1) hue-rotate(0deg)",
                    ],
              }
        }
        transition={{
          duration: pressed ? 3.3 : 6.7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Drifting inner highlight — irregular period vs core */}
      <motion.span
        aria-hidden
        className="absolute rounded-full mix-blend-screen pointer-events-none"
        style={{
          top: coreInset,
          left: coreInset,
          right: coreInset,
          bottom: coreInset,
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.98 0.08 85 / 0.65) 0%, transparent 45%), radial-gradient(circle at 70% 75%, oklch(0.65 0.20 295 / 0.45) 0%, transparent 55%), radial-gradient(circle at 50% 50%, oklch(0.74 0.17 355 / 0.25) 0%, transparent 60%)",
        }}
        animate={
          reduced
            ? undefined
            : {
                borderRadius: pressed ? blobPressed : blobIdle,
                opacity: pressed ? [0.9, 1, 0.8, 0.95, 0.9] : [0.65, 0.9, 0.55, 0.8, 0.65],
                scale: pressed ? [1, 1.08, 0.94, 1.04, 1] : [1, 1.03, 0.97, 1.02, 1],
              }
        }
        transition={{
          duration: pressed ? 3.9 : 13,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Specular rim */}
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
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
