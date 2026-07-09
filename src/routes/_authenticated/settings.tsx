import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Zap, Mic, Link2, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

const SECTIONS = [
  { icon: User, label: "Account", hint: "Profile, billing, referrals" },
  { icon: Mic, label: "Voice & Style", hint: "Personas, samples, directives" },
  { icon: Zap, label: "Content Ops", hint: "Templates, presets, tuning" },
  { icon: Link2, label: "Distribution", hint: "Channels, email sender, calendar" },
  { icon: Bell, label: "Notifications", hint: "Inbox rules, snoozes" },
];

function Settings() {
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
          <button
            key={s.label}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-elev"
          >
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.hint}</div>
            </div>
          </button>
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
