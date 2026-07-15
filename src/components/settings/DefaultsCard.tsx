import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Mic, BookOpen, Compass, AlertCircle } from "lucide-react";
import { getActiveVoice } from "@/lib/voice/voice.functions";
import { listProfiles } from "@/lib/knowledge/knowledge.functions";
import { listDomains } from "@/lib/settings/settings.functions";

// Snapshot of what every AI workflow will use as its defaults right now.
// Reads the same signals resolveMilestoneContext + resolveActiveVoice do.
export function DefaultsCard() {
  const activeFn = useServerFn(getActiveVoice);
  const profilesFn = useServerFn(listProfiles);
  const domainsFn = useServerFn(listDomains);

  const { data: voice } = useQuery({
    queryKey: ["voice-active"],
    queryFn: () => activeFn(),
    staleTime: 30_000,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () => profilesFn(),
    staleTime: 30_000,
  });
  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => domainsFn(),
    staleTime: 30_000,
  });

  const knowledge =
    (profiles as { id: string; name: string; is_default?: boolean }[]).find(
      (p) => p.is_default,
    ) ?? profiles[0] ?? null;
  const domain =
    (domains as { id: string; name: string; is_default?: boolean }[]).find(
      (d) => d.is_default,
    ) ?? null;

  const Row = ({
    icon: Icon,
    label,
    value,
    to,
    missing,
  }: {
    icon: typeof Mic;
    label: string;
    value: string | null;
    to: string;
    missing?: boolean;
  }) => (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs hover:bg-surface-elev"
    >
      <Icon className="h-3.5 w-3.5 text-accent" />
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`ml-auto truncate ${
          missing ? "text-destructive" : "font-medium text-foreground"
        }`}
      >
        {value ?? "Not set"}
        {missing && <AlertCircle className="ml-1 inline h-3 w-3" />}
      </span>
    </Link>
  );

  return (
    <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
      <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-wide text-accent">
        Your defaults · used everywhere
      </div>
      <Row icon={Mic} label="Voice" value={voice?.name ?? null} to="/settings/voice" missing={!voice} />
      <Row
        icon={BookOpen}
        label="Knowledge"
        value={knowledge?.name ?? null}
        to="/settings/knowledge"
        missing={!knowledge}
      />
      <Row
        icon={Compass}
        label="Domain"
        value={domain?.name ?? null}
        to="/settings/domains"
        missing={!domain}
      />
    </div>
  );
}
