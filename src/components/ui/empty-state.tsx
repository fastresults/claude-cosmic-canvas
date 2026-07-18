import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * Shared empty-state primitive. Keeps tone, spacing, and iconography
 * consistent across drafts, archive, library, media, and queue views.
 */
export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elev text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
