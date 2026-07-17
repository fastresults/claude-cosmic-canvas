import { useEffect, useState } from "react";
import { X, Lightbulb } from "lucide-react";

/**
 * Dismissible one-time coach mark. Keyed by `id` in localStorage so it
 * disappears after the first dismiss and stays gone across sessions.
 */
export function FirstRunTip({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const storageKey = `eve.firstRunTip.${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch {
      // storage unavailable — silently skip
    }
  }, [storageKey]);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-foreground">
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="flex-1 min-w-0">
          <div className="mb-1 text-sm font-medium text-foreground">{title}</div>
          <div className="text-muted-foreground">{children}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {
              // ignore
            }
            setVisible(false);
          }}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss tip"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
