// Shared source of truth for the user's three global defaults:
// Voice, Knowledge (Curriculum Vitae) profile, and Domain.
// Every surface that reads or gates on defaults uses this hook so a mutation
// anywhere invalidates one set of query keys and every consumer updates.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveVoice } from "@/lib/voice/voice.functions";
import { listProfiles } from "@/lib/knowledge/knowledge.functions";
import { listDomains } from "@/lib/settings/settings.functions";

export type DefaultSlot = "voice" | "knowledge" | "domain";

export type UserDefaults = {
  voice: { id: string; name: string } | null;
  knowledge: { id: string; name: string } | null;
  domain: { id: string; name: string } | null;
  loading: boolean;
  missing: DefaultSlot[];
  ready: boolean;
};

export function useUserDefaults(): UserDefaults {
  const activeFn = useServerFn(getActiveVoice);
  const profilesFn = useServerFn(listProfiles);
  const domainsFn = useServerFn(listDomains);

  const voiceQ = useQuery({
    queryKey: ["voice-active"],
    queryFn: () => activeFn(),
    staleTime: 30_000,
  });
  const profilesQ = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () => profilesFn(),
    staleTime: 30_000,
  });
  const domainsQ = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => domainsFn(),
    staleTime: 30_000,
  });

  const profiles = (profilesQ.data ?? []) as {
    id: string;
    name: string;
    is_default?: boolean;
  }[];
  const domains = (domainsQ.data ?? []) as {
    id: string;
    name: string;
    is_default?: boolean;
  }[];

  const voice = voiceQ.data
    ? { id: (voiceQ.data as { id: string }).id, name: (voiceQ.data as { name: string }).name }
    : null;
  const knowledge = profiles.find((p) => p.is_default) ?? null;
  const domain = domains.find((d) => d.is_default) ?? null;

  const loading = voiceQ.isLoading || profilesQ.isLoading || domainsQ.isLoading;
  const missing: DefaultSlot[] = [];
  if (!voice) missing.push("voice");
  if (!knowledge) missing.push("knowledge");
  if (!domain) missing.push("domain");

  return {
    voice,
    knowledge: knowledge ? { id: knowledge.id, name: knowledge.name } : null,
    domain: domain ? { id: domain.id, name: domain.name } : null,
    loading,
    missing,
    ready: !loading && missing.length === 0,
  };
}

export const DEFAULT_SLOT_META: Record<
  DefaultSlot,
  { label: string; to: string; hint: string }
> = {
  voice: { label: "Voice", to: "/settings/voice", hint: "Voice & Style" },
  knowledge: {
    label: "Knowledge",
    to: "/settings/knowledge",
    hint: "Curriculum Vitae",
  },
  domain: { label: "Domain", to: "/settings/domains", hint: "Domains" },
};
