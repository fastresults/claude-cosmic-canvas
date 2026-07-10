import type { ReactNode } from "react";

/** Sticky bottom action dock. One-thumb usable at 375px. */
export function DecisionDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-auto sticky bottom-0 z-10 mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-border bg-background/90 px-3 py-2 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      {children}
    </div>
  );
}
