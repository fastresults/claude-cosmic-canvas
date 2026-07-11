/**
 * ThumbPeek: mobile-first tap-to-peek, tap-again-to-select thumbnail wrapper.
 *
 * Touch: first tap opens a magnified overlay (no selection).
 *        Second tap on the enlarged image or the confirm button commits selection.
 * Pointer:fine: hover opens the overlay (no selection); click commits immediately.
 * Backdrop / Esc / ✕ / swipe-down dismiss without selecting.
 *
 * Pass `confirmLabel={undefined}` to render a view-only overlay (no confirm button).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ThumbPeekProps = {
  src: string;
  alt?: string;
  label?: string;
  selected?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
  className?: string;
  children: ReactNode;
};

function useHoverCapable() {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHover(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  return hover;
}

export function ThumbPeek({
  src,
  alt = "",
  label,
  selected,
  confirmLabel = "Use this",
  onConfirm,
  className,
  children,
}: ThumbPeekProps) {
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const hoverTimer = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const canConfirm = confirmLabel !== undefined;

  const close = useCallback(() => setOpen(false), []);

  const commit = useCallback(() => {
    onConfirm?.();
    setOpen(false);
  }, [onConfirm]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Hover-intent open (desktop only)
  const handlePointerEnter = () => {
    if (!hoverCapable) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), 150);
  };
  const handlePointerLeave = () => {
    if (!hoverCapable) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setOpen(false);
  };

  const handleTileClick = () => {
    if (hoverCapable) {
      // Desktop: click = select (or just peek if no confirm handler)
      if (canConfirm && onConfirm) commit();
      else setOpen(true);
      return;
    }
    // Touch: first tap opens; if already open, treat as second-tap commit
    if (!open) setOpen(true);
    else if (canConfirm) commit();
  };

  const overlay = useMemo(() => {
    if (!open) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in-0 motion-reduce:animate-none"
        role="dialog"
        aria-modal="true"
        aria-label={label ? `Preview: ${label}` : "Preview"}
        onClick={close}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartY.current;
          const end = e.changedTouches[0]?.clientY ?? null;
          touchStartY.current = null;
          if (start != null && end != null && end - start > 60) close();
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </button>
        <div
          className="flex max-h-[92vh] w-full max-w-[720px] flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={canConfirm ? commit : close}
            className="overflow-hidden rounded-2xl bg-black/40 shadow-2xl"
            aria-label={canConfirm ? `${confirmLabel}` : "Close preview"}
          >
            <img
              src={src}
              alt={alt}
              className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
            />
          </button>
          <div className="flex items-center gap-2 rounded-2xl bg-black/40 px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              {label && <div className="truncate text-sm font-medium">{label}</div>}
              <div className="text-[11px] text-white/60">
                {canConfirm ? "Tap image again to select · swipe down to close" : "Tap outside to close"}
              </div>
            </div>
            {canConfirm && (
              <>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                >
                  {confirmLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  }, [open, label, close, commit, canConfirm, confirmLabel, src, alt]);

  return (
    <>
      <button
        type="button"
        onClick={handleTileClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        aria-pressed={selected}
        aria-haspopup="dialog"
        className={cn(
          "relative block text-left transition-shadow",
          selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
          !selected && open && "ring-2 ring-accent/50 ring-offset-2 ring-offset-background",
          className,
        )}
      >
        {children}
      </button>
      {overlay}
    </>
  );
}
