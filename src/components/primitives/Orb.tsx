import { motion } from "framer-motion";
import { useState } from "react";

type OrbProps = {
  size?: number;
  idleOnly?: boolean;
  onPress?: () => void;
  onRelease?: () => void;
};

/**
 * The Orb — Eve's primary interaction surface.
 * Idle: 6s turbulence breathing loop.
 * Press: amber halo pulses; STT wires in M1.
 */
export function Orb({ size = 200, idleOnly, onPress, onRelease }: OrbProps) {
  const [pressed, setPressed] = useState(false);

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

  return (
    <button
      type="button"
      aria-label={idleOnly ? "Eve" : "Hold to speak"}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      className="relative touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ width: size, height: size }}
    >
      {/* Ambient halo — always on, brightens on press */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: pressed
            ? [
                "0 0 40px 8px oklch(0.82 0.14 82 / 0.5)",
                "0 0 60px 14px oklch(0.82 0.14 82 / 0.35)",
                "0 0 40px 8px oklch(0.82 0.14 82 / 0.5)",
              ]
            : [
                "0 0 30px 4px oklch(0.82 0.14 82 / 0.18)",
                "0 0 45px 8px oklch(0.82 0.14 82 / 0.28)",
                "0 0 30px 4px oklch(0.82 0.14 82 / 0.18)",
              ],
        }}
        transition={{
          duration: pressed ? 0.9 : 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Core orb */}
      <motion.span
        aria-hidden
        className="absolute inset-2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.95 0.10 82) 0%, oklch(0.82 0.14 82) 40%, oklch(0.55 0.12 60) 100%)",
        }}
        animate={{
          scale: pressed ? [1, 1.05, 1] : [1, 1.02, 1],
          opacity: pressed ? 1 : 0.92,
        }}
        transition={{
          duration: pressed ? 0.6 : 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner shimmer */}
      <span
        aria-hidden
        className="absolute inset-6 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle at 70% 70%, transparent 40%, oklch(0.95 0.10 82 / 0.4) 100%)",
        }}
      />
    </button>
  );
}
