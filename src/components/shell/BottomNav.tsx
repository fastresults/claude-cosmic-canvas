import { Link, useLocation } from "@tanstack/react-router";
import { Home, BookOpen, Zap, Brain, Settings as SettingsIcon } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/library", label: "Library", icon: BookOpen, match: (p: string) => p.startsWith("/library") },
  { to: "/arcs", label: "Arcs", icon: Zap, match: (p: string) => p.startsWith("/arcs") },
  { to: "/brain", label: "Brain", icon: Brain, match: (p: string) => p.startsWith("/brain") },
  { to: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings") },
] as const;

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border frosted"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] transition-colors"
              aria-current={active ? "page" : undefined}
            >
              <t.icon
                className={`h-5 w-5 transition-colors ${
                  active ? "text-accent" : "text-muted-foreground"
                }`}
              />
              <span
                className={`transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
