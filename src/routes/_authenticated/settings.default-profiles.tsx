import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
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
  Search,
  X,
  ChevronDown,
  Library,
  UserRound,
} from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { ProfileVsPresetCard } from "@/components/settings/ProfileVsPresetCard";
import { FirstRunTip } from "@/components/onboarding/FirstRunTip";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Textarea } from "@/components/ui/textarea";
import { useDefaultProfiles } from "@/hooks/useDefaultProfiles";
import {
  adoptSystemVoice,
  listSystemVoices,
  listVoiceProfiles,
} from "@/lib/voice/voice.functions";
import { listProfiles as listKnowledgeProfiles } from "@/lib/knowledge/knowledge.functions";
import { listDomains } from "@/lib/settings/settings.functions";
import { listAudiences } from "@/lib/audiences/audiences.functions";

export const Route = createFileRoute("/_authenticated/settings/default-profiles")({
  component: DefaultProfilesPage,
});

type UserVoiceOption = {
  id: string;
  name: string;
  category?: string | null;
  tone?: string | null;
  formality?: number | null;
  humor?: number | null;
  technicality?: number | null;
  conciseness?: number | null;
};

type SystemVoiceOption = {
  id: string;
  name: string;
  profession?: string | null;
  tagline?: string | null;
  category?: string | null;
  tone?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  public_figures: "Public Figures",
  business_leaders: "Business Leaders",
  consulting_strategy: "Consulting & Strategy",
  marketing_sales: "Marketing & Sales",
  thought_leadership: "Thought Leadership",
  academic_journalism: "Academic & Journalism",
  journalism: "Journalism",
  coaching_self_help: "Coaching & Self-Help",
  investment_finance: "Investment & Finance",
  spirituality: "Spirituality",
  other: "Other",
};

function DefaultProfilesPage() {
  const { profiles, isLoading, remove, favorite, setDefault, apply } =
    useDefaultProfiles();
  const [sheet, setSheet] = useState<
    { mode: "create" } | { mode: "edit"; profile: (typeof profiles)[number] } | null
  >(null);

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
        <EmptyProfileGuide onStart={() => setSheet({ mode: "create" })} />
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
                onClick={() => setSheet({ mode: "edit", profile: p })}
                className="rounded-md p-1 text-muted-foreground hover:text-accent"
                aria-label={`Edit profile ${p.name}`}
              >
                <Pencil className="h-4 w-4" />
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
        onClick={() => setSheet({ mode: "create" })}
        aria-label="New profile"
        className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 sm:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <ProfileSheet
        open={sheet !== null}
        onOpenChange={(v) => {
          if (!v) setSheet(null);
        }}
        profile={sheet?.mode === "edit" ? sheet.profile : null}
      />
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

type ProfileRow = {
  id: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  voice_id?: string | null;
  knowledge_profile_id?: string | null;
  domain_id?: string | null;
  audience_id?: string | null;
};

function ProfileSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: ProfileRow | null;
}) {
  const { create, update } = useDefaultProfiles();
  const isEdit = !!profile;
  const qc = useQueryClient();
  const listVoicesFn = useServerFn(listVoiceProfiles);
  const listSystemVoicesFn = useServerFn(listSystemVoices);
  const adoptSystemVoiceFn = useServerFn(adoptSystemVoice);
  const listKnowledgeFn = useServerFn(listKnowledgeProfiles);
  const listDomainsFn = useServerFn(listDomains);
  const listAudiencesFn = useServerFn(listAudiences);

  const { data: voices = [] } = useQuery({
    queryKey: ["voice-profiles-list"],
    queryFn: () => listVoicesFn({ data: {} }),
  });
  const { data: systemVoices = [], isLoading: systemVoicesLoading } = useQuery({
    queryKey: ["system-voices"],
    queryFn: () => listSystemVoicesFn({ data: {} }),
    staleTime: 5 * 60_000,
    enabled: open,
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
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  const adoptVoice = useMutation({
    mutationFn: (id: string) => adoptSystemVoiceFn({ data: { id } }),
    onSuccess: (row) => {
      setVoiceId(row.id);
      qc.invalidateQueries({ queryKey: ["voice-profiles-list"] });
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      qc.invalidateQueries({ queryKey: ["voice-active"] });
    },
  });


  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setDescription(profile?.description ?? "");
    setEmoji(profile?.emoji ?? "");
    setVoiceId(profile?.voice_id ?? "");
    setKnowledgeId(profile?.knowledge_profile_id ?? "");
    setDomainId(profile?.domain_id ?? "");
    setAudienceId(profile?.audience_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.id]);


  const dedupeByName = <T extends { id: string; name: string }>(items: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of items) {
      const key = (it.name ?? "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  };
  const voiceList = useMemo(
    () => dedupeByName((voices as UserVoiceOption[]) ?? []),
    [voices],
  );
  const systemVoiceList = useMemo(
    () => dedupeByName((systemVoices as SystemVoiceOption[]) ?? []),
    [systemVoices],
  );
  const audienceList = useMemo(
    () => dedupeByName((audiences as { id: string; name: string }[]) ?? []),
    [audiences],
  );
  const knowledgeList = useMemo(
    () => dedupeByName((knowledge as { id: string; name: string }[]) ?? []),
    [knowledge],
  );
  const domainList = useMemo(
    () => dedupeByName((domains as { id: string; name: string }[]) ?? []),
    [domains],
  );

  async function save() {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || null,
      voice_id: voiceId || null,
      knowledge_profile_id: knowledgeId || null,
      domain_id: domainId || null,
      audience_id: audienceId || null,
    };
    if (isEdit && profile) {
      await update.mutateAsync({ id: profile.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  }


  return (
    <EveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit profile" : "New profile"}

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
          systemOptions={systemVoiceList}
          loadingSystem={systemVoicesLoading}
          adoptingId={adoptVoice.isPending ? adoptVoice.variables : undefined}
          onAdoptSystemVoice={async (id) => {
            await adoptVoice.mutateAsync(id);
          }}
          open={voicePickerOpen}
          onOpenChange={setVoicePickerOpen}
        />
        <SlotSelect
          icon={<BookOpen className="h-3.5 w-3.5" />}
          label="Knowledge"
          value={knowledgeId}
          onChange={setKnowledgeId}
          options={knowledgeList}
          createHref="/settings/knowledge"
          createLabel="Create a new knowledge profile"
        />
        <SlotSelect
          icon={<Compass className="h-3.5 w-3.5" />}
          label="Domain"
          value={domainId}
          onChange={setDomainId}
          options={domainList}
          createHref="/settings/domains"
          createLabel="Create a new domain"
        />
        <SlotSelect
          icon={<Users className="h-3.5 w-3.5" />}
          label="Audience"
          value={audienceId}
          onChange={setAudienceId}
          options={audienceList}
          createHref="/settings/audiences"
          createLabel="Create a new audience"
        />


        <button
          type="button"
          onClick={save}
          disabled={!name.trim() || create.isPending || update.isPending}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {(create.isPending || update.isPending) ? "Saving…" : isEdit ? "Save changes" : "Save profile"}
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
  systemOptions,
  loadingSystem,
  adoptingId,
  onAdoptSystemVoice,
  open,
  onOpenChange,
  createHref,
  createLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  systemOptions?: SystemVoiceOption[];
  loadingSystem?: boolean;
  adoptingId?: string;
  onAdoptSystemVoice?: (id: string) => Promise<void>;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  createHref?: string;
  createLabel?: string;
}) {
  if (label === "Voice" && systemOptions && onAdoptSystemVoice && onOpenChange) {
    return (
      <VoicePicker
        icon={icon}
        label={label}
        value={value}
        onChange={onChange}
        options={options as UserVoiceOption[]}
        systemOptions={systemOptions}
        loadingSystem={Boolean(loadingSystem)}
        adoptingId={adoptingId}
        onAdoptSystemVoice={onAdoptSystemVoice}
        open={Boolean(open)}
        onOpenChange={onOpenChange}
      />
    );
  }

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
      {createHref && (
        <Link
          to={createHref}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          <Plus className="h-3 w-3" />
          {createLabel ?? `Create new ${label.toLowerCase()}`}
        </Link>
      )}
    </div>
  );
}


function VoicePicker({
  icon,
  label,
  value,
  onChange,
  options,
  systemOptions,
  loadingSystem,
  adoptingId,
  onAdoptSystemVoice,
  open,
  onOpenChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: UserVoiceOption[];
  systemOptions: SystemVoiceOption[];
  loadingSystem: boolean;
  adoptingId?: string;
  onAdoptSystemVoice: (id: string) => Promise<void>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "mine" | "library">("all");
  const [category, setCategory] = useState("all");
  const selected = options.find((o) => o.id === value);

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    for (const item of [...options, ...systemOptions]) {
      if (item.category) cats.add(item.category);
    }
    return ["all", ...Array.from(cats).sort((a, b) => {
      const la = CATEGORY_LABELS[a] ?? a;
      const lb = CATEGORY_LABELS[b] ?? b;
      return la.localeCompare(lb);
    })];
  }, [options, systemOptions]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (parts: Array<string | number | null | undefined>) => {
    if (!normalizedQuery) return true;
    return parts.join(" ").toLowerCase().includes(normalizedQuery);
  };
  const showMine = source === "all" || source === "mine";
  const showLibrary = source === "all" || source === "library";
  const filteredMine = options.filter((voice) => {
    if (category !== "all" && voice.category !== category) return false;
    return matchesQuery([
      voice.name,
      voice.category,
      CATEGORY_LABELS[voice.category ?? ""],
      voice.tone,
      voice.formality,
      voice.humor,
      voice.technicality,
      voice.conciseness,
    ]);
  });
  const ownedNames = new Set(options.map((o) => o.name.trim().toLowerCase()));
  const filteredLibrary = systemOptions.filter((voice) => {
    if (ownedNames.has(voice.name.trim().toLowerCase())) return false;
    if (category !== "all" && voice.category !== category) return false;
    return matchesQuery([
      voice.name,
      voice.profession,
      voice.tagline,
      voice.category,
      CATEGORY_LABELS[voice.category ?? ""],
      voice.tone,
    ]);
  });
  const hasResults = (showMine && filteredMine.length > 0) ||
    (showLibrary && filteredLibrary.length > 0);
  const resetFilters = () => {
    setQuery("");
    setSource("all");
    setCategory("all");
  };

  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </label>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-input bg-surface-elev px-3 py-2 text-left text-sm outline-none focus:border-accent"
      >
        <span className="min-w-0">
          <span className={selected ? "block truncate text-foreground" : "block text-muted-foreground"}>
            {selected ? selected.name : "Choose from all voices"}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {selected?.tone ?? "Search saved voices and the full voice library"}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
          onClick={() => onOpenChange(false)}
        >
          <div
            className="flex h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-border bg-card shadow-2xl sm:h-[78vh] sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border bg-card px-4 py-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Mic className="h-4 w-4 text-accent" />
                    Choose voice
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Search saved voices or adopt one from the curated library.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Close voice picker"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by voice, category, tone, profession…"
                  className="w-full rounded-md border border-input bg-surface-elev py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
                  autoFocus
                />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {([
                  ["all", "All"],
                  ["mine", "My voices"],
                  ["library", "Library"],
                ] as const).map(([key, text]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSource(key)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium ${
                      source === key
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface-elev text-muted-foreground"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] ${
                      category === cat
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface-elev text-muted-foreground"
                    }`}
                  >
                    {cat === "all" ? "All categories" : CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    onOpenChange(false);
                  }}
                  className="mb-3 flex w-full items-center justify-between rounded-md border border-dashed border-border bg-surface-elev px-3 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
                >
                  <span>No voice for this profile</span>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {showMine && (
                <VoicePickerSection
                  title="My voices"
                  count={filteredMine.length}
                  icon={<UserRound className="h-3.5 w-3.5" />}
                >
                  {filteredMine.map((voice) => (
                    <VoiceOptionButton
                      key={voice.id}
                      selected={value === voice.id}
                      title={voice.name}
                      subtitle={voice.tone ?? undefined}
                      meta={[
                        voice.category ? CATEGORY_LABELS[voice.category] ?? voice.category : undefined,
                        voice.formality != null ? `Formality ${voice.formality}` : undefined,
                        voice.technicality != null ? `Technicality ${voice.technicality}` : undefined,
                      ]}
                      actionLabel={value === voice.id ? "Selected" : "Use"}
                      onClick={() => {
                        onChange(voice.id);
                        onOpenChange(false);
                      }}
                    />
                  ))}
                </VoicePickerSection>
              )}

              {showLibrary && (
                <VoicePickerSection
                  title="Voice library"
                  count={filteredLibrary.length}
                  forceVisible={loadingSystem}
                  icon={<Library className="h-3.5 w-3.5" />}
                >
                  {loadingSystem ? (
                    <div className="rounded-md border border-border p-4 text-center text-xs text-muted-foreground">
                      Loading voice library…
                    </div>
                  ) : (
                    filteredLibrary.map((voice) => (
                      <VoiceOptionButton
                        key={voice.id}
                        selected={false}
                        title={voice.name}
                        subtitle={voice.tagline ?? voice.profession ?? undefined}
                        meta={[
                          voice.category ? CATEGORY_LABELS[voice.category] ?? voice.category : undefined,
                          voice.profession ?? undefined,
                          voice.tone ?? undefined,
                        ]}
                        actionLabel={adoptingId === voice.id ? "Adding…" : "Add + use"}
                        disabled={Boolean(adoptingId)}
                        onClick={async () => {
                          await onAdoptSystemVoice(voice.id);
                          onOpenChange(false);
                        }}
                      />
                    ))
                  )}
                </VoicePickerSection>
              )}

              {!hasResults && !loadingSystem && (
                <div className="rounded-md border border-dashed border-border p-6 text-center">
                  <div className="text-sm font-medium text-foreground">No voices match</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different search, source, or category.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            <div className="border-t border-border bg-card px-4 py-3">
              <Link
                to="/settings/voice"
                onClick={() => onOpenChange(false)}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent/50 bg-accent/5 px-3 py-2.5 text-sm font-medium text-accent hover:bg-accent/10"
              >
                <Plus className="h-4 w-4" />
                Create a new voice
              </Link>
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                Don't see the voice you want? Build one in Voice settings.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function VoicePickerSection({
  title,
  count,
  forceVisible = false,
  icon,
  children,
}: {
  title: string;
  count: number;
  forceVisible?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  if (count === 0 && !forceVisible) return null;
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </div>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function VoiceOptionButton({
  selected,
  title,
  subtitle,
  meta,
  actionLabel,
  disabled,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  meta: Array<string | undefined>;
  actionLabel: string;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  const visibleMeta = meta.filter(Boolean) as string[];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-md border px-3 py-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
        selected
          ? "border-accent bg-accent/15"
          : "border-border bg-surface-elev hover:border-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-medium text-foreground">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${
          selected ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground"
        }`}>
          {selected && <Check className="mr-1 inline h-3 w-3" />}
          {actionLabel}
        </span>
      </div>
      {visibleMeta.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleMeta.slice(0, 4).map((item) => (
            <span
              key={item}
              className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function EmptyProfileGuide({ onStart }: { onStart: () => void }) {
  const steps = [
    { n: 1, title: "Pick your Voice", hint: "How you sound." },
    { n: 2, title: "Point at your Knowledge", hint: "What you draw from." },
    { n: 3, title: "Set your Audience", hint: "Who you're writing for." },
  ];
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-elev p-5">
      <div className="mb-1 text-sm font-medium text-foreground">
        Build your first Profile in 3 steps
      </div>
      <div className="mb-4 text-xs text-muted-foreground">
        This becomes your active identity. Every draft you write uses it until
        you switch.
      </div>
      <ol className="mb-4 space-y-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {s.title}
              </div>
              <div className="text-[11px] text-muted-foreground">{s.hint}</div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onStart}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Build my first Profile
      </button>
    </div>
  );
}
