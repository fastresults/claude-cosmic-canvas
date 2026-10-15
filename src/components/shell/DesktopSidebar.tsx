import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Command } from "lucide-react";
import { TABS, useFirstMissingRoute } from "./BottomNav";

/** Persistent left navigation for desktop (lg+). Same tabs and setup lock as BottomNav. */
export function DesktopSidebar({ gated = false }: { gated?: boolean }) {
  const path = useLocation().pathname;
  const navigate = useNavigate();
  const firstMissingRoute = useFirstMissingRoute();

  return (
    <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 flex-col border-r border-border bg-surface/60 px-3 py-4 lg:flex">
      <nav className="flex flex-col gap-1" aria-label="Main">
        {TABS.map((t) => {
          const active = t.match(path);
          const locked = gated && t.requiresSetup;
          const Icon = t.icon;
          const cls = `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            active
              ? "bg-accent/15 font-medium text-foreground"
              : locked
                ? "text-muted-foreground/60 hover:bg-surface-elev"
                : "text-muted-foreground hover:bg-surface-elev hover:text-foreground"
          }`;
          const body = (
            <>
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent" : ""}`} />
              <span className="flex-1 truncate">{t.label}</span>
              {locked && <Lock className="h-3 w-3 text-accent" />}
            </>
          );
          if (locked) {
            return (
              <button
                key={t.to}
                type="button"
                aria-disabled="true"
                className={`${cls} text-left`}
                onClick={() => {
                  toast.message("Finish setup first", {
                    description: "This unlocks as soon as your four steps are done.",
                  });
                  void navigate({ to: firstMissingRoute(), search: { setup: 1 } as never });
                }}
              >
                {body}
              </button>
            );
          }
          return (
            <Link key={t.to} to={t.to} className={cls} aria-current={active ? "page" : undefined}>
              {body}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2 px-3 text-xs text-muted-foreground">
        <Command className="h-3 w-3" />
        <span>Press ? for shortcuts</span>
      </div>
    </aside>
  );
}
