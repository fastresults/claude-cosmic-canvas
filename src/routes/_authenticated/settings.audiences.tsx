import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Users, Plus, X, Sparkles, Star, Loader2, ChevronDown, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { hapticTap } from "@/lib/platform/haptics";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import {
  listAudiences,
  createAudience,
  deleteAudience,
  setDefaultAudience,
  updateAudience,
  suggestAudienceFromContext,
  type Icp,
} from "@/lib/audiences/audiences.functions";


export const Route = createFileRoute("/_authenticated/settings/audiences")({
  component: AudiencesSettings,
});

type Audience = {
  id: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  icp?: Partial<Icp> | null;
  is_default?: boolean;
  is_ai_generated?: boolean;
};

const KEY = ["audiences"] as const;

function AudiencesSettings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAudiences);
  const createFn = useServerFn(createAudience);
  const delFn = useServerFn(deleteAudience);
  const setDefaultFn = useServerFn(setDefaultAudience);
  const updateFn = useServerFn(updateAudience);
  const suggestFn = useServerFn(suggestAudienceFromContext);


  const { data: audiences = [] } = useQuery({
    queryKey: KEY,
    queryFn: () => listFn() as Promise<Audience[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["default-profiles"] });
  };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<{
    name: string;
    description: string;
    icp: Icp;
    is_duplicate_warning?: boolean;
    duplicate_of?: string | null;
  } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [rejectedNames, setRejectedNames] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 4000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const create = useMutation({
    mutationFn: (v: { name: string; description?: string; icp?: Icp }) => createFn({ data: v }),
    onSuccess: () => {
      setName(""); setDescription(""); setSuggestion(null); setManualOpen(false);
      setRejectedNames([]); setError(null); setSavedFlash(true); invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not add audience"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultFn({ data: { id } }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Audience[]>(KEY);
      qc.setQueryData<Audience[]>(KEY, (old = []) =>
        old.map((audience) => ({
          ...audience,
          is_default: audience.id === id,
        })),
      );
      return { previous };
    },
    onError: (e: unknown, _id, context) => {
      if (context?.previous) qc.setQueryData(KEY, context.previous);
      toast.error(e instanceof Error ? e.message : "Could not switch audience");
    },
    onSuccess: (result, id) => {
      const audienceName = result?.audience?.name ?? audiences.find((a) => a.id === id)?.name;
      toast.success(audienceName ? `Now targeting ${audienceName}` : "Audience updated");
    },
    onSettled: invalidate,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; name?: string; description?: string }) => updateFn({ data: v }),
    onSuccess: invalidate,
  });
  const suggest = useMutation({
    mutationFn: (avoid: string[]) => suggestFn({ data: { avoid_names: avoid } }),
    onSuccess: (r) => {
      setSuggestion({
        name: r.name,
        description: r.description,
        icp: r.icp,
        is_duplicate_warning: r.is_duplicate_warning,
        duplicate_of: r.duplicate_of,
      });
      setName(r.name);
      setDescription(r.description);
      setError(null);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "AI draft failed"),
  });
  


  const draftNext = () => suggest.mutate(rejectedNames);
  const regenerate = () => {
    const next = suggestion ? [...rejectedNames, suggestion.name] : rejectedNames;
    setRejectedNames(next);
    suggest.mutate(next);
  };
  const discard = () => {
    if (suggestion) setRejectedNames((r) => [...r, suggestion.name]);
    setSuggestion(null);
    setName("");
    setDescription("");
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    create.mutate({ name: n, description: description.trim() || undefined, icp: suggestion?.icp });
  };

  const hasDraft = !!suggestion;
  const showFields = hasDraft || manualOpen;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <SettingsPageHeader
        title="Audiences"
        description="Your target Ideal Customer Profiles (ICPs). Every generation is shaped for the active audience — tone, examples, objections, and channels. Set one as default and Eve uses it everywhere."
      />

      <section className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium text-foreground">Add an audience</label>
          <button
            type="button"
            onClick={draftNext}
            disabled={suggest.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {hasDraft ? "Draft another" : "Draft next audience with AI"}
          </button>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          Eve reviews your domain, knowledge, and existing audiences, then proposes the next-largest ICP that doesn't overlap with what you already have.
        </p>

        {savedFlash && (
          <div className="mb-3 rounded-md border border-accent/40 bg-accent/10 p-2.5 text-xs text-accent">
            Saved. Draft another to broaden your reach, or set one as default below.
          </div>
        )}

        {suggestion?.is_duplicate_warning && (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-500">
            This may overlap with <span className="font-medium">{suggestion.duplicate_of}</span>. Regenerate or edit before saving.
          </div>
        )}

        {showFields && (
          <>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              maxLength={120}
              placeholder="e.g. Series-A founders in DevTools"
              className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={800}
              placeholder="One sentence describing who they are and what they care about."
              className="mt-2 w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {suggestion && (
              <div className="mt-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-accent">AI-drafted ICP attached</div>
                {suggestion.icp.persona && <div><span className="text-foreground">Persona:</span> {suggestion.icp.persona}</div>}
                {(suggestion.icp.role_titles ?? []).length > 0 && (
                  <div><span className="text-foreground">Roles:</span> {suggestion.icp.role_titles!.slice(0, 4).join(", ")}</div>
                )}
                {(suggestion.icp.industries ?? []).length > 0 && (
                  <div><span className="text-foreground">Industries:</span> {suggestion.icp.industries!.slice(0, 4).join(", ")}</div>
                )}
                {(suggestion.icp.pains ?? []).length > 0 && (
                  <div><span className="text-foreground">Pains:</span> {suggestion.icp.pains!.slice(0, 3).join("; ")}</div>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {hasDraft && (
                <>
                  <button
                    type="button"
                    onClick={discard}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-elev"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={regenerate}
                    disabled={suggest.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs text-accent hover:bg-accent/15 disabled:opacity-50"
                  >
                    {suggest.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Regenerate
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim() || create.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Save audience
              </button>
            </div>
          </>
        )}

        {!showFields && (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-elev hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add manually instead
          </button>
        )}

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </section>


      <section className="mt-6">
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Active audience · tap to switch{audiences.length > 0 ? ` · ${audiences.length}` : ""}
        </h2>
        {audiences.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
            No audiences yet. Use "Draft next audience with AI" above to let Eve propose your first ICP from your Domain and knowledge.
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Eve uses your <span className="text-foreground">active audience</span> for every draft — tone, examples, and channels adapt to fit. Switch anytime.
            </p>
            {(() => {
              const active = audiences.find((x) => x.is_default);
              return active ? (
                <div className="mb-2 text-xs text-muted-foreground">
                  Active: <span className="font-medium text-accent">{active.name}</span>
                </div>
              ) : (
                <div className="mb-2 text-xs text-amber-500">
                  No audience selected — tap one below to activate.
                </div>
              );
            })()}
            <ul role="radiogroup" aria-label="Choose active audience" className="space-y-2">
              {audiences.map((a) => {
                const isOpen = expanded === a.id;
                const isActive = !!a.is_default;
                const icp = (a.icp ?? {}) as Partial<Icp>;
                const activate = () => {
                  if (isActive || setDefault.isPending) return;
                  hapticTap();
                  setDefault.mutate(a.id);
                };
                return (
                  <li key={a.id}>
                    <div
                      role="radio"
                      aria-checked={isActive}
                      tabIndex={0}
                      onClick={activate}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          activate();
                        }
                      }}
                      className={`overflow-hidden rounded-lg border bg-card transition-colors ${
                        isActive
                          ? "border-accent bg-accent/5 ring-1 ring-accent/40"
                          : `border-border ${setDefault.isPending ? "opacity-70" : "cursor-pointer hover:border-accent/50 active:bg-surface-elev"}`
                      }`}
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2 py-2">
                        <span
                          aria-hidden="true"
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                            isActive
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-muted-foreground/40 bg-transparent"
                          }`}
                        >
                          {isActive && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <div className="flex min-w-0 flex-col items-start text-left">
                          <div className="flex min-w-0 items-center gap-2">
                            <Users className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-muted-foreground"}`} />
                            <span className="truncate text-sm text-foreground">{a.name}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 pl-6">
                            {isActive ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                                <Star className="h-2.5 w-2.5" /> Active
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Tap anywhere to activate</span>
                            )}
                            {a.is_ai_generated && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                AI
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : a.id); }}
                            aria-label={isOpen ? `Collapse ${a.name}` : `Expand ${a.name}`}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-elev"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); remove.mutate(a.id); }}
                            aria-label={`Remove ${a.name}`}
                            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-surface-elev hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isOpen && (

                      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                        {a.description && <p className="mb-2 text-foreground">{a.description}</p>}
                        <Field label="Persona" value={icp.persona} />
                        <Field label="Roles" value={icp.role_titles?.join(", ")} />
                        <Field label="Industries" value={icp.industries?.join(", ")} />
                        <Field label="Company size" value={icp.company_size} />
                        <Field label="Seniority" value={icp.seniority} />
                        <Field label="Goals" value={icp.goals?.join("; ")} />
                        <Field label="Pains" value={icp.pains?.join("; ")} />
                        <Field label="Channels" value={icp.channels?.join(", ")} />
                        <Field label="Tone" value={icp.tone_preference} />
                        <Field label="Objections" value={icp.objections?.join("; ")} />
                        <Field label="Success metrics" value={icp.success_metrics?.join("; ")} />
                        <div className="mt-3">
                          <RenameRow audience={a} onSave={(name) => update.mutate({ id: a.id, name })} />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={draftNext}
              disabled={suggest.isPending}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-elev/50 px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              {suggest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Draft another audience with AI
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-1">
      <span className="text-foreground">{label}:</span> {value}
    </div>
  );
}

function RenameRow({ audience, onSave }: { audience: Audience; onSave: (name: string) => void }) {
  const [value, setValue] = useState(audience.name);
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={120}
        className="flex-1 rounded-md border border-input bg-surface-elev px-2 py-1 text-xs outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={() => value.trim() && value !== audience.name && onSave(value.trim())}
        className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
        disabled={!value.trim() || value === audience.name}
      >
        Rename
      </button>
    </div>
  );
}
