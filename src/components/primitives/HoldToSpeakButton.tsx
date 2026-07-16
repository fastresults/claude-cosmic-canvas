import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";
import { hapticTap, hapticStart, hapticEnd, hapticCancel } from "@/lib/platform/haptics";

type Props = {
  onStart?: () => void;
  onEnd?: () => void;
  onCancel?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Live mic level 0..1 — drives the reactive glow around the button. */
  level?: number;
  /**
   * When true, a quick tap toggles a sticky recording mode instead of
   * requiring the user to keep holding. Defaults to true.
   */
  allowTapToggle?: boolean;
};

const TAP_THRESHOLD_MS = 250;

export function HoldToSpeakButton({
  onStart,
  onEnd,
  onCancel,
  active = false,
  disabled = false,
  level = 0,
  allowTapToggle = true,
}: Props) {
  const [holding, setHolding] = useState(false);
  const [sticky, setSticky] = useState(false);
  const pointerRef = useRef<number | null>(null);
  const pressedAtRef = useRef<number>(0);

  const recording = holding || sticky || active;

  function start(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    // If already in sticky recording, a tap should stop it.
    if (sticky) {
      setSticky(false);
      hapticEnd();
      onEnd?.();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = e.pointerId;
    pressedAtRef.current = Date.now();
    setHolding(true);
    hapticStart();
    onStart?.();
  }

  function end(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    if (pointerRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(pointerRef.current);
      } catch {
        /* ignore */
      }
    }
    pointerRef.current = null;
    if (!holding) return;
    const held = Date.now() - pressedAtRef.current;
    setHolding(false);
    if (allowTapToggle && held < TAP_THRESHOLD_MS) {
      // Treat as tap → enter sticky mode; recording continues until next tap.
      setSticky(true);
      hapticTap();
      return;
    }
    hapticEnd();
    onEnd?.();
  }

  function cancel(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    if (pointerRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(pointerRef.current);
      } catch {
        /* ignore */
      }
    }
    pointerRef.current = null;
    if (!holding) return;
    setHolding(false);
    hapticCancel();
    onCancel?.();
  }

  // Level-reactive glow ring (0..24px)
  const glow = Math.round(6 + level * 22);
  const ringOpacity = 0.35 + level * 0.5;
  const glowStyle: React.CSSProperties = recording
    ? {
        boxShadow: `0 0 0 2px oklch(0.82 0.14 82 / ${ringOpacity.toFixed(2)}), 0 0 ${glow}px oklch(0.82 0.14 82 / 0.55)`,
      }
    : {};

  return (
    <button
      type="button"
      aria-label={recording ? "Stop recording" : "Hold to speak, tap to toggle"}
      aria-pressed={recording}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      style={glowStyle}
      className={`relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full touch-none select-none transition-all duration-150 ${
        recording
          ? "bg-accent text-accent-foreground scale-105"
          : "bg-primary text-primary-foreground hover:scale-105"
      } disabled:opacity-40`}
    >
      {recording && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-accent/50 animate-ping"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[-4px] rounded-full border border-accent/40 motion-safe:animate-pulse"
          />
        </>
      )}
      {recording ? <Square className="relative h-3.5 w-3.5 fill-current" /> : <Mic className="relative h-4 w-4" />}
    </button>
  );
}
