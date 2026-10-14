import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { VoicePoweredOrb } from "@/components/primitives/VoicePoweredOrb";

type OrbProps = {
  size?: number;
  idleOnly?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
  /** External audio level 0..1 (e.g. from useAudioLevel) — the orb reacts to it. */
  level?: number;
};

/**
 * The Orb — Eve's primary interaction surface.
 * A WebGL plasma orb (VoicePoweredOrb) wrapped in Eve's press/haptic button
 * contract. Falls back to a static amber core before hydration and under
 * reduced motion.
 */
export function Orb({ size = 200, idleOnly, onPress, onRelease, level }: OrbProps) {
  const [pressed, setPressed] = useState(false);
  const [glReady, setGlReady] = useState(false);
  const reduced = useReducedMotion();

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
      {/* Ambient outer glow — pulses harder while pressed */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        animate={
          reduced
            ? { boxShadow: "0 0 0px 0px oklch(0 0 0 / 0)" }
            : {
                boxShadow: pressed
                  ? [
                      "0 0 60px 14px oklch(0.82 0.14 82 / 0.6), 0 0 120px 30px oklch(0.65 0.20 295 / 0.25)",
                      "0 0 90px 24px oklch(0.65 0.20 295 / 0.55), 0 0 140px 40px oklch(0.74 0.17 355 / 0.25)",
                      "0 0 60px 14px oklch(0.82 0.14 82 / 0.6), 0 0 120px 30px oklch(0.65 0.20 295 / 0.25)",
                    ]
                  : "0 0 0px 0px oklch(0 0 0 / 0)",
              }
        }
        transition={{
          duration: pressed ? 3.3 : 8.7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Faint ring fallback — visible until WebGL paints */}
      <span
        aria-hidden
        className="absolute rounded-full [.light_&]:hidden"
        style={{
          inset: s * 0.11,
          border: "2px solid oklch(0.82 0.14 82 / 0.7)",
          boxShadow: "0 0 24px 2px oklch(0.65 0.20 295 / 0.35)",
          opacity: glReady ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
      />

      {/* Light theme only: soft contact shadow that grounds the orb on paper */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: s * 0.7,
          height: s * 0.12,
          bottom: s * 0.02,
          background: "var(--orb-lift)",
        }}
      />

      {/* WebGL plasma orb */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          transform: pressed ? "scale(1.06)" : "scale(1)",
          transition: "transform 300ms ease-out",
        }}
      >
        <VoicePoweredOrb level={level} still={reduced ?? false} onReady={() => setGlReady(true)} />
      </span>
    </button>
  );
}
