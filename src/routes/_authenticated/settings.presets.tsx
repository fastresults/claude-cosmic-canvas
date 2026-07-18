import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Star,
  StarOff,
  Trash2,
  Check,
  Sparkles,
  Compass,
  Users,
  FileText,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { ProfileVsPresetCard } from "@/components/settings/ProfileVsPresetCard";
import { FirstRunTip } from "@/components/onboarding/FirstRunTip";
import { Textarea } from "@/components/ui/textarea";
import { Pill } from "@/components/primitives/Pill";
import { EveSheet } from "@/components/primitives/EveSheet";
import { usePresets } from "@/hooks/usePresets";
import {
  buildPresetFromSeed,
  listAudiences,
  addAudience,
  getPreset,
} from "@/lib/presets/presets.functions";
import { listDomains } from "@/lib/settings/settings.functions";

export const Route = createFileRoute("/_authenticated/settings/presets")({
  component: PresetsPage,
});

type Filter = "all" | "favorites" | "used" | "recent";

function PresetsPage() {
  const { presets, isLoading, remove, favorite, setDefault } = usePresets();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...presets];
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      );
    }
    if (filter === "favorites") list = list.filter((p) => p.is_favorite);
    if (filter === "used") list.sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0));
    if (filter === "recent") {
      list.sort(
        (a, b) =>
          new Date(b.last_used_at ?? b.updated_at).getTime() -
          new Date(a.last_used_at ?? a.updated_at).getTime(),
      );
    }
    return list;
  }, [presets, query, filter]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-4">
      <SettingsPageHeader
        title="Presets"
        description="Saved briefs for one piece — the lens you pick per draft."
      />

      <ProfileVsPresetCard current="preset" />

      <FirstRunTip
        id="presets-vs-profiles"
        title="When to reach for a Preset"
      >
        Your active <strong className="text-foreground">Profile</strong>{" "}
        already carries Voice, Knowledge, Domain, and Audience. Use a{" "}
        <strong className="text-foreground">Preset</strong> when this specific
        piece needs a different tone, format, length, or angle.
      </FirstRunTip>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets"
            className="w-full rounded-md border border-input bg-surface-elev py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["favorites", "Favorites"],
            ["used", "Most used"],
            ["recent", "Recent"],
          ] as const
        ).map(([id, label]) => (
          <Pill
            key={id}
            type="button"
            size="sm"
            variant={filter === id ? "solid" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        query || filter !== "all" ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
            No presets match.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-5">
            <div className="mb-1 text-sm font-medium text-foreground">
              Save your first Preset
            </div>
            <div className="mb-4 text-xs text-muted-foreground">
              Think of a piece you write often — a launch post, a customer
              recap, a milestone update. Capture how it should feel once, then
              pick it from the composer every time.
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Create my first Preset
            </button>
            <div className="mt-3 text-center text-[11px] text-muted-foreground">
              Not sure yet?{" "}
              <Link
                to="/settings/default-profiles"
                className="text-accent hover:underline"
              >
                Start with a Profile instead
              </Link>{" "}
              — it sets your baseline identity.
            </div>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3"
            >
              <button
                type="button"
                onClick={() => favorite.mutate({ id: p.id, favorite: !p.is_favorite })}
                className="rounded-md p-1 text-muted-foreground hover:text-accent"
                aria-label={p.is_favorite ? "Unfavorite" : "Favorite"}
              >
                {p.is_favorite ? (
                  <Star className="h-4 w-4 fill-current" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setDetailId(p.id)}
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  {p.is_default && (
                    <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                      Default
                    </span>
                  )}
                </div>
                {p.description && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.description}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Used {p.use_count ?? 0}× ·{" "}
                  {p.last_used_at
                    ? new Date(p.last_used_at).toLocaleDateString()
                    : "never used"}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDefault.mutate(p.is_default ? null : p.id)}
                className="rounded-md p-1 text-muted-foreground hover:text-accent"
                aria-label={p.is_default ? "Clear default" : "Set as default"}
              >
                <Check className={`h-4 w-4 ${p.is_default ? "text-accent" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete preset "${p.name}"? This also removes its Brain edges.`)) {
                    remove.mutate(p.id);
                  }
                }}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                aria-label="Delete preset"
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
        aria-label="New preset"
        className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 sm:right-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreatePresetSheet open={creating} onOpenChange={setCreating} />
      <PresetDetailSheet id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

// ============================ Create sheet ============================

function CreatePresetSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [seed, setSeed] = useState("");
  const [preview, setPreview] = useState<null | {
    name: string;
    description: string;
    brief_config: Record<string, unknown>;
    suggested_domains: string[];
    suggested_audiences: string[];
    research_summary: string;
    research_items: { content: string; source?: string; relevance?: number }[];
  }>(null);
  const { create } = usePresets();
  const buildFn = useServerFn(buildPresetFromSeed);
  const listDomainsFn = useServerFn(listDomains);
  const listAudFn = useServerFn(listAudiences);
  const addAudFn = useServerFn(addAudience);
  const qc = useQueryClient();

  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => listDomainsFn(),
  });
  const { data: audiences = [] } = useQuery({
    queryKey: ["settings", "audiences"],
    queryFn: () => listAudFn(),
  });

  const build = useMutation({
    mutationFn: (s: string) => buildFn({ data: { seed: s } }),
    onSuccess: (out) => setPreview(out),
  });

  async function save() {
    if (!preview) return;
    // Map suggested names to ids; auto-create missing audiences; missing domains ignored (user manages via Domains page).
    const domainIds = domains
      .filter((d) =>
        preview.suggested_domains.some(
          (s) => s.toLowerCase() === d.name.toLowerCase(),
        ),
      )
      .map((d) => d.id);

    const audienceIds: string[] = [];
    for (const name of preview.suggested_audiences) {
      const existing = audiences.find(
        (a) => a.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        audienceIds.push(existing.id);
      } else {
        try {
          const row = await addAudFn({ data: { name } });
          audienceIds.push(row.id);
        } catch {
          /* ignore duplicates / validation errors */
        }
      }
    }

    await create.mutateAsync({
      name: preview.name,
      description: preview.description,
      brief_config: preview.brief_config,
      selected_domain_ids: domainIds,
      selected_audience_ids: audienceIds,
      research_context: {
        summary: preview.research_summary,
        items: preview.research_items,
      },
    });
    qc.invalidateQueries({ queryKey: ["settings", "audiences"] });
    reset();
    onOpenChange(false);
  }

  function reset() {
    setSeed("");
    setPreview(null);
    build.reset();
  }

  return (
    <EveSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New preset"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Seed
          </label>
          <Textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Describe what this preset is for. e.g. 'Thought-leader op-eds on AI safety for enterprise CTOs, cautious and evidence-based.'"
            rows={4}
            className="border-input bg-surface-elev p-3 focus-visible:border-accent"
          />
        </div>

        {!preview && (
          <button
            type="button"
            onClick={() => build.mutate(seed)}
            disabled={seed.trim().length < 8 || build.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {build.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {build.isPending ? "Building preset…" : "Build preset from seed"}
          </button>
        )}

        {build.error && (
          <p className="text-xs text-destructive">
            {build.error instanceof Error ? build.error.message : "Build failed"}
          </p>
        )}

        {preview && (
          <div className="space-y-4 rounded-lg border border-border bg-surface-elev p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Name</div>
              <input
                value={preview.name}
                onChange={(e) => setPreview({ ...preview, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Description
              </div>
              <Textarea
                value={preview.description}
                onChange={(e) => setPreview({ ...preview, description: e.target.value })}
                rows={2}
                className="mt-1 border-input bg-surface focus-visible:border-accent"
              />
            </div>

            <PreviewSection icon={<Compass className="h-3.5 w-3.5" />} label="Domains">
              {preview.suggested_domains.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {preview.suggested_domains.map((d) => {
                    const known = domains.some(
                      (x) => x.name.toLowerCase() === d.toLowerCase(),
                    );
                    return (
                      <span
                        key={d}
                        className={`rounded-pill border px-2 py-0.5 text-xs ${known ? "border-accent/40 text-accent" : "border-border text-muted-foreground"}`}
                        title={known ? "Matches existing domain" : "Not in your Domains — add it in Settings → Domains to link"}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">None suggested</span>
              )}
            </PreviewSection>

            <PreviewSection icon={<Users className="h-3.5 w-3.5" />} label="Audiences">
              {preview.suggested_audiences.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {preview.suggested_audiences.map((a) => (
                    <span
                      key={a}
                      className="rounded-pill border border-border px-2 py-0.5 text-xs text-foreground"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">None suggested</span>
              )}
              <div className="mt-1 text-[10px] text-muted-foreground">
                New audiences will be auto-created and become Brain nodes.
              </div>
            </PreviewSection>

            <PreviewSection icon={<FileText className="h-3.5 w-3.5" />} label="Research">
              <p className="text-xs text-muted-foreground">{preview.research_summary}</p>
              {preview.research_items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {preview.research_items.map((r, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">
                      • {r.content}
                      {r.source && <span className="text-accent"> · {r.source}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </PreviewSection>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={save}
                disabled={create.isPending}
                className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {create.isPending ? "Saving…" : "Save preset"}
              </button>
            </div>
          </div>
        )}
      </div>
    </EveSheet>
  );
}

function PreviewSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

// ============================ Detail sheet ============================

function PresetDetailSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const getFn = useServerFn(getPreset);
  const listDomainsFn = useServerFn(listDomains);
  const listAudFn = useServerFn(listAudiences);

  const { data: preset, isLoading } = useQuery({
    queryKey: ["preset", id],
    queryFn: () => (id ? getFn({ data: { id } }) : null),
    enabled: !!id,
  });
  const { data: domains = [] } = useQuery({
    queryKey: ["settings", "domains"],
    queryFn: () => listDomainsFn(),
  });
  const { data: audiences = [] } = useQuery({
    queryKey: ["settings", "audiences"],
    queryFn: () => listAudFn(),
  });

  return (
    <EveSheet open={!!id} onOpenChange={(v) => !v && onClose()} title={preset?.name ?? "Preset"}>
      {isLoading || !preset ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          {preset.description && (
            <p className="text-sm text-muted-foreground">{preset.description}</p>
          )}

          <DetailSection icon={<Compass className="h-3.5 w-3.5" />} label="Domains">
            <DomainAudienceList
              ids={preset.selected_domain_ids ?? []}
              lookup={domains}
              emptyLabel="No domains linked"
            />
          </DetailSection>

          <DetailSection icon={<Users className="h-3.5 w-3.5" />} label="Audiences">
            <DomainAudienceList
              ids={preset.selected_audience_ids ?? []}
              lookup={audiences}
              emptyLabel="No audiences linked"
            />
          </DetailSection>

          <DetailSection icon={<FileText className="h-3.5 w-3.5" />} label="Brief">
            <KeyValueList data={preset.brief_config} empty="No brief configured." />
          </DetailSection>

          <DetailSection icon={<Layers className="h-3.5 w-3.5" />} label="Brain links">
            <div className="text-xs text-muted-foreground">
              This preset appears as a node in your Brain, linked to its domains, audiences, and documents.
            </div>
            <Link
              to="/brain"
              className="mt-2 inline-block text-xs text-accent hover:underline"
            >
              Open Brain →
            </Link>
          </DetailSection>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-elev"
            >
              <X className="mr-1 inline h-3.5 w-3.5" /> Close
            </button>
          </div>
        </div>
      )}
    </EveSheet>
  );
}

function DetailSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function DomainAudienceList({
  ids,
  lookup,
  emptyLabel,
}: {
  ids: string[];
  lookup: { id: string; name: string }[];
  emptyLabel: string;
}) {
  if (!ids.length) {
    return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const found = lookup.find((x) => x.id === id);
        return (
          <span
            key={id}
            className="rounded-pill border border-border px-2 py-0.5 text-xs text-foreground"
          >
            {found?.name ?? "—"}
          </span>
        );
      })}
    </div>
  );
}
