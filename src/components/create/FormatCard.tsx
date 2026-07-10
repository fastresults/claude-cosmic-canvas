import type { CreateFormat } from "@/config/createFormats";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function FormatCard({ format }: { format: CreateFormat }) {
  return (
    <Link
      to="/create/$formatId"
      params={{ formatId: format.id }}
      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/60 active:scale-[0.99]"
    >
      <div>
        <h3 className="font-display text-base leading-tight text-foreground">{format.label}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{format.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{format.category}</span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
