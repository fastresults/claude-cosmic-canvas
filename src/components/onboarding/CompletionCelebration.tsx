// Completion celebration for the onboarding journey. Confetti + haptic that
// respect prefers-reduced-motion. Small, self-contained, no deps beyond
// framer-motion.
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { hapticEnd } from "@/lib/platform/haptics";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CompletionCelebration() {
  const reduced = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    if (!reduced) {
      try {
        hapticEnd();
      } catch {
        // haptic not supported — no-op
      }
    }
  }, [reduced]);

  if (reduced) return null;

  const pieces = Array.from({ length: 24 });
  const colors = ["#fbbf24", "#f59e0b", "#a78bfa", "#22d3ee", "#f472b6", "#34d399"];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.8 + Math.random() * 1.6;
        const rotate = (Math.random() - 0.5) * 720;
        const color = colors[i % colors.length];
        return (
          <motion.span
            key={i}
            initial={{ y: -20, x: 0, opacity: 0, rotate: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate }}
            transition={{ duration, delay, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: 0,
              width: 8,
              height: 12,
              background: color,
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
  );
}
