import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "outline";
  size?: "sm" | "md";
  children: ReactNode;
};

export function Pill({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill transition-colors",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        variant === "solid" &&
          "bg-accent text-accent-foreground hover:opacity-90",
        variant === "ghost" &&
          "bg-surface-elev text-foreground hover:bg-secondary",
        variant === "outline" &&
          "border border-border bg-transparent text-foreground hover:bg-surface-elev",
        className,
      )}
    >
      {children}
    </button>
  );
}
