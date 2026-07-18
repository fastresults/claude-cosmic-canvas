import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  count?: number;
  className?: string;
};

/**
 * Consistent list skeleton for draft/library/archive/media loading states.
 * Replaces plain "Loading…" text with layout-preserving placeholders so
 * content shift is minimized when data resolves.
 */
export function ListSkeleton({ count = 4, className }: Props) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-2", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
        >
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
