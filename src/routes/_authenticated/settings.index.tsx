import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  User,
  Zap,
  Mic,
  Link2,
  Bell,
  BookOpen,
  Compass,
  Layers,
  ChevronRight,
  SunMoon,
  AlertCircle,
} from "lucide-react";
import { useUserDefaults, type DefaultSlot } from "@/hooks/useUserDefaults";
import { listProfiles, setDefaultKnowledgeProfile } from "@/lib/knowledge/knowledge.functions";
import { listDomains, setDefaultDomain } from "@/lib/settings/settings.functions";

export const Route = createFileRoute("/_authenticated/settings/")({
  component: SettingsIndex,
});

type Section = {
  to: string;
  icon: typeof User;
  label: string;
  hint: string;
  slot?: DefaultSlot;
};

const SECTIONS: Section[] = [
  { to: "/settings/account", icon: User, label: "Account", hint: "Profile and sign out" },
  { to: "/settings/voice", icon: Mic, label: "Voice & Style", hint: "Personas, samples, directives", slot: "voice" },
  { to: "/settings/knowledge", icon: BookOpen, label: "Curriculum Vitae", hint: "LinkedIn, résumé, bios, notes", slot: "knowledge" },
  { to: "/settings/domains", icon: Compass, label: "Domains", hint: "Passions and areas of expertise", slot: "domain" },
  { to: "/settings/presets", icon: Layers, label: "Presets", hint: "Reusable content lenses (voice + domains + audience + refs)" },
  { to: "/settings/distribution", icon: Link2, label: "Distribution", hint: "Channels, email sender, calendar" },
  { to: "/settings/notifications", icon: Bell, label: "Notifications", hint: "Inbox rules, snoozes" },
  { to: "/settings/appearance", icon: SunMoon, label: "Appearance", hint: "Light or dark theme" },
  { to: "/settings/content-ops", icon: Zap, label: "Content Ops", hint: "Templates, presets, tuning" },
];

function SettingsIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const d = useUserDefaults();

  const listProfilesFn = useServerFn(listProfiles);
  const setDefaultKnowledgeFn = useServerFn(setDefaultKnowledgeProfile);
  const { data: knowledgeProfiles = [] } = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () =>
      listProfilesFn() as Promise<{ id: string; name: string; is_default?: boolean }[]>,
    staleTime: 30_000,
  });
  const setKnowledgeDefault = useMutation({
    mutationFn: (id: string) => setDefaultKnowledgeFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge", "profiles"] }),
  });

  const listDomainsFn = useServerFn(listDomains);
  const setDefaultDomainFn = useServerFn(setDefaultDomain);
  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () =>
      listDomainsFn() as Promise<{ id: string; name: string; is_default?: boolean }[]>,
    staleTime: 30_000,
  });
  const setDomainDefault = useMutation({
    mutationFn: (id: string) => setDefaultDomainFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings", "domains"] }),
  });

  const valueFor = (slot?: DefaultSlot): string | null => {
    if (!slot) return null;
    if (slot === "voice") return d.voice?.name ?? null;
    if (slot === "knowledge") return d.knowledge?.name ?? null;
    if (slot === "domain") return d.domain?.name ?? null;
    return null;
  };

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
        <p className="mt-1 text-xs text-muted-foreground">
          The three defaults below drive every draft, milestone, and campaign.
        </p>
      </header>

      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const value = valueFor(s.slot);
          const showPill = !!s.slot;
          const missing = showPill && !value;
          return (
            <Link
              key={s.label}
              to={s.to}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-elev"
            >
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  {showPill && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-display text-[10px] tracking-wide ${
                        missing
                          ? "border-destructive/50 bg-destructive/10 text-destructive"
                          : "border-accent/40 bg-accent/10 text-accent"
                      }`}
                    >
                      {missing ? (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Not set
                        </>
                      ) : (
                        <>Default · {value}</>
                      )}
                    </span>
                  )}
                  {showPill && s.slot === "knowledge" && missing && knowledgeProfiles.length > 0 && (
                    <select
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.target.value;
                        if (id) setKnowledgeDefault.mutate(id);
                      }}
                      defaultValue=""
                      disabled={setKnowledgeDefault.isPending}
                      className="rounded-pill border border-accent/40 bg-surface-elev px-2 py-0.5 font-display text-[10px] tracking-wide text-accent"
                    >
                      <option value="" disabled>
                        Pick default…
                      </option>
                      {knowledgeProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {showPill && s.slot === "domain" && missing && domains.length > 0 && (
                    <select
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onChange={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.target.value;
                        if (id) setDomainDefault.mutate(id);
                      }}
                      defaultValue=""
                      disabled={setDomainDefault.isPending}
                      className="rounded-pill border border-accent/40 bg-surface-elev px-2 py-0.5 font-display text-[10px] tracking-wide text-accent"
                    >
                      <option value="" disabled>
                        Pick default…
                      </option>
                      {domains.map((dm) => (
                        <option key={dm.id} value={dm.id}>
                          {dm.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.hint}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}

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
