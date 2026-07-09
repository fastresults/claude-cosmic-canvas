import { Mic } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  onStart?: () => void;
  onEnd?: () => void;
  active?: boolean;
  disabled?: boolean;
};

export function HoldToSpeakButton({ onStart, onEnd, active = false, disabled = false }: Props) {
  const [holding, setHolding] = useState(false);
  const pointerRef = useRef<number | null>(null);

  function start(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = e.pointerId;
    setHolding(true);
    onStart?.();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(6);
    }
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
    setHolding(false);
    onEnd?.();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
  }

  return (
    <button
      type="button"
      aria-label={holding || active ? "Recording voice" : "Hold to speak"}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full touch-none select-none transition-all ${
        holding || active ? "bg-accent text-accent-foreground amber-glow" : "bg-primary text-primary-foreground"
      }`}
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
