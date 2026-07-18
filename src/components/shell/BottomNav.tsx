import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Home, BookOpen, Zap, Send, Brain, Settings as SettingsIcon, Lock } from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";

const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/", requiresSetup: false },
  { to: "/library", label: "Library", icon: BookOpen, match: (p: string) => p.startsWith("/library"), requiresSetup: true },
  { to: "/arcs", label: "Arcs", icon: Zap, match: (p: string) => p.startsWith("/arcs"), requiresSetup: true },
  { to: "/queue", label: "Queue", icon: Send, match: (p: string) => p.startsWith("/queue"), requiresSetup: true },
  { to: "/brain", label: "Brain", icon: Brain, match: (p: string) => p.startsWith("/brain"), requiresSetup: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p.startsWith("/settings"), requiresSetup: false },
] as const;

export function BottomNav({ gated = false }: { gated?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const defaults = useUserDefaults();

  function firstMissingRoute(): string {
    const order: { slot: DefaultSlot; to: string }[] = [
      { slot: "voice", to: "/settings/voice" },
      { slot: "knowledge", to: "/settings/knowledge" },
      { slot: "domain", to: "/settings/domains" },
      { slot: "audience", to: "/settings/audiences" },
    ];
    const present: Record<DefaultSlot, boolean> = {
      voice: !!defaults.voice,
      knowledge: !!defaults.knowledge,
      domain: !!defaults.domain,
      audience: !!defaults.audience,
    };
    return order.find((o) => !present[o.slot])?.to ?? "/settings/voice";
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border frosted"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(path);
          const locked = gated && t.requiresSetup;
          const Icon = t.icon;
          const body = (
            <>
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    active ? "text-accent" : locked ? "text-muted-foreground/60" : "text-muted-foreground"
                  }`}
                />
                {locked && (
                  <Lock className="absolute -right-1.5 -top-1 h-2.5 w-2.5 text-accent" />
                )}
              </div>
              <span
                className={`transition-colors ${
                  active ? "text-foreground" : locked ? "text-muted-foreground/60" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </span>
            </>
          );

          if (locked) {
            return (
              <button
                key={t.to}
                type="button"
                aria-disabled="true"
                className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px]"
                onClick={() => {
                  toast.message("Finish setup first", {
                    description: "This unlocks as soon as your four steps are done.",
                  });
                  void navigate({ to: firstMissingRoute(), search: { setup: 1 } as never });
                }}
              >
                {body}
                <span className="sr-only">Locked. Finish setup first.</span>
              </button>
            );
          }

          return (
            <Link
              key={t.to}
              to={t.to}
              className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] transition-colors"
              aria-current={active ? "page" : undefined}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
