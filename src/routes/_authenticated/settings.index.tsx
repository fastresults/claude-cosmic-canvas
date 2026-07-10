import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Zap, Mic, Link2, Bell, BookOpen, Compass, Layers, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsIndex,
});

const SECTIONS = [
  { to: "/settings/account", icon: User, label: "Account", hint: "Profile and sign out" },
  { to: "/settings/voice", icon: Mic, label: "Voice & Style", hint: "Personas, samples, directives" },
  { to: "/settings/knowledge", icon: BookOpen, label: "Curriculum Vitae", hint: "LinkedIn, résumé, bios, notes" },
  { to: "/settings/domains", icon: Compass, label: "Domains", hint: "Passions and areas of expertise" },
  { to: "/settings/presets", icon: Layers, label: "Presets", hint: "Reusable content lenses (voice + domains + audience + refs)" },
  { to: "/settings/distribution", icon: Link2, label: "Distribution", hint: "Channels, email sender, calendar" },
  { to: "/settings/notifications", icon: Bell, label: "Notifications", hint: "Inbox rules, snoozes" },
  { to: "/settings/content-ops", icon: Zap, label: "Content Ops", hint: "Templates, presets, tuning" },
] as const;

function SettingsIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Settings</h1>
      </header>

      <div className="space-y-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-elev"
          >
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}

        <button
          onClick={handleSignOut}
          className="mt-6 flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Sign out</span>
        </button>
      </div>
    </div>
  );
}
