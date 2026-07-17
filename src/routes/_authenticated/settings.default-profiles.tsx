import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Star,
  StarOff,
  Trash2,
  Check,
  Loader2,
  Mic,
  BookOpen,
  Compass,
  Users,
  Zap,
} from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { ProfileVsPresetCard } from "@/components/settings/ProfileVsPresetCard";
import { FirstRunTip } from "@/components/onboarding/FirstRunTip";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Textarea } from "@/components/ui/textarea";
import { useDefaultProfiles } from "@/hooks/useDefaultProfiles";
import { listVoiceProfiles } from "@/lib/voice/voice.functions";
import { listProfiles as listKnowledgeProfiles } from "@/lib/knowledge/knowledge.functions";
import { listDomains } from "@/lib/settings/settings.functions";
import { listAudiences } from "@/lib/audiences/audiences.functions";

export const Route = createFileRoute("/_authenticated/settings/default-profiles")({
  component: DefaultProfilesPage,
});

function DefaultProfilesPage() {
  const { profiles, isLoading, remove, favorite, setDefault, apply } =
    useDefaultProfiles();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      <SettingsPageHeader
        title="Profiles"
        description="Your active identity, ready in one tap."
      />

      <ProfileVsPresetCard current="profile" />

      <FirstRunTip
        id="profiles-vs-presets"
        title="Profile vs Preset — the 10-second version"
      >
        A <strong className="text-foreground">Profile</strong> is who you are
        right now (Voice, Knowledge, Domain, Audience). A{" "}
        <strong className="text-foreground">Preset</strong> is the brief for
        one piece (tone, format, length, references). Switch Profile when you
        switch hats; pick a Preset per draft.
      </FirstRunTip>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <EmptyProfileGuide onStart={() => setCreating(true)} />
      ) : (
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3"
            >
              <button
                type="button"
                onClick={() =>
                  favorite.mutate({ id: p.id, favorite: !p.is_favorite })
                }
                className="rounded-md p-1 text-muted-foreground hover:text-accent"
                aria-label={p.is_favorite ? "Unfavorite" : "Favorite"}
              >
                {p.is_favorite ? (
                  <Star className="h-4 w-4 fill-current" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {p.emoji && <span className="text-base">{p.emoji}</span>}
                  <span className="text-sm font-medium text-foreground truncate">
                    {p.name}
                  </span>
                  {p.is_default && (
                    <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                      Active
                    </span>
                  )}
                </div>
                {p.description && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <SlotChip icon={Mic} id={p.voice_id} kind="voice" />
                  <SlotChip icon={BookOpen} id={p.knowledge_profile_id} kind="knowledge" />
                  <SlotChip icon={Compass} id={p.domain_id} kind="domain" />
                  <SlotChip icon={Users} id={p.audience_id ?? null} kind="audience" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => apply.mutate(p.id)}
                disabled={apply.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
                aria-label={`Apply profile ${p.name}`}
              >
                <Zap className="h-3 w-3" />
                Apply
              </button>
              <button
                type="button"
                onClick={() => setDefault.mutate(p.is_default ? null : p.id)}
                className="rounded-md p-1 text-muted-foreground hover:text-accent"
                aria-label={p.is_default ? "Clear active" : "Set as active"}
              >
                <Check className={`h-4 w-4 ${p.is_default ? "text-accent" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete profile "${p.name}"?`)) remove.mutate(p.id);
                }}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                aria-label="Delete profile"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="New profile"
        className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 sm:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateProfileSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function SlotChip({
  icon: Icon,
  id,
  kind,
}: {
  icon: typeof Mic;
  id: string | null;
  kind: "voice" | "knowledge" | "domain" | "audience";
}) {
  const labels = {
    voice: "Voice",
    knowledge: "Knowledge",
    domain: "Domain",
    audience: "Audience",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 ${
        id
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-dashed border-border text-muted-foreground"
      }`}
    >
      <Icon className="h-2.5 w-2.5" />
      {id ? labels[kind] : `No ${labels[kind].toLowerCase()}`}
    </span>
  );
}

function CreateProfileSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { create } = useDefaultProfiles();
  const listVoicesFn = useServerFn(listVoiceProfiles);
  const listKnowledgeFn = useServerFn(listKnowledgeProfiles);
  const listDomainsFn = useServerFn(listDomains);
  const listAudiencesFn = useServerFn(listAudiences);

  const { data: voices = [] } = useQuery({
    queryKey: ["voice-profiles-list"],
    queryFn: () => listVoicesFn(),
  });
  const { data: knowledge = [] } = useQuery({
    queryKey: ["knowledge", "profiles"],
    queryFn: () => listKnowledgeFn(),
  });
  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => listDomainsFn(),
  });
  const { data: audiences = [] } = useQuery({
    queryKey: ["audiences"],
    queryFn: () => listAudiencesFn(),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [domainId, setDomainId] = useState<string>("");
  const [audienceId, setAudienceId] = useState<string>("");

  function reset() {
    setName("");
    setDescription("");
    setEmoji("");
    setVoiceId("");
    setKnowledgeId("");
    setDomainId("");
    setAudienceId("");
  }

  const voiceList = useMemo(
    () => (voices as { id: string; name: string }[]) ?? [],
    [voices],
  );
  const audienceList = useMemo(
    () => (audiences as { id: string; name: string }[]) ?? [],
    [audiences],
  );

  async function save() {
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || null,
      voice_id: voiceId || null,
      knowledge_profile_id: knowledgeId || null,
      domain_id: domainId || null,
      audience_id: audienceId || null,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <EveSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New profile"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="w-16">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Emoji
            </label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🎯"
              maxLength={4}
              className="w-full rounded-md border border-input bg-surface-elev px-2 py-2 text-center text-lg outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Thought-leader mode"
              className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this profile is for."
            rows={2}
            className="border-input bg-surface-elev focus-visible:border-accent"
          />
        </div>

        <SlotSelect
          icon={<Mic className="h-3.5 w-3.5" />}
          label="Voice"
          value={voiceId}
          onChange={setVoiceId}
          options={voiceList}
        />
        <SlotSelect
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Knowledge"
          value={knowledgeId}
          onChange={setKnowledgeId}
          options={knowledge as { id: string; name: string }[]}
        />
        <SlotSelect
          icon={<Compass className="h-3.5 w-3.5" />}
          label="Domain"
          value={domainId}
          onChange={setDomainId}
          options={domains as { id: string; name: string }[]}
        />
        <SlotSelect
          icon={<Users className="h-3.5 w-3.5" />}
          label="Audience"
          value={audienceId}
          onChange={setAudienceId}
          options={audienceList}
        />

        <button
          type="button"
          onClick={save}
          disabled={!name.trim() || create.isPending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </EveSheet>
  );
}

function SlotSelect({
  icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
      >
        <option value="">— none —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
