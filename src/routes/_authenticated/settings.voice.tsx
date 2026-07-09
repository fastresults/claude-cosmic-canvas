import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Pill } from "@/components/primitives/Pill";
import { Trash2, Plus, Check } from "lucide-react";
import {
  createPersona,
  deletePersona,
  getMyProfile,
  getVoiceProfile,
  listPersonas,
  renamePersona,
  setActivePersona,
  upsertVoiceProfile,
} from "@/lib/settings/settings.functions";

export const Route = createFileRoute("/_authenticated/settings/voice")({
  component: VoiceSettings,
});

type Sample = { text: string; source?: string };

function VoiceSettings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPersonas);
  const profileFn = useServerFn(getMyProfile);
  const createFn = useServerFn(createPersona);
  const renameFn = useServerFn(renamePersona);
  const deleteFn = useServerFn(deletePersona);
  const activateFn = useServerFn(setActivePersona);

  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => listFn(),
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn(),
  });

  const activeId = profile?.persona_active_id ?? null;

  const [newName, setNewName] = useState("");

  const create = useMutation({
    mutationFn: (name: string) => createFn({ data: { name } }),
    onSuccess: () => {
      setNewName("");
      qc.invalidateQueries({ queryKey: ["personas"] });
    },
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => renameFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personas"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["personas"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  const activate = useMutation({
    mutationFn: (id: string) => activateFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Voice & Style"
        description="Personas, writing samples, and hard rules. Eve pulls from your active persona every time it drafts."
      />

      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Personas</h2>
          <span className="text-xs text-muted-foreground">
            {personas.length} total
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New persona name (e.g. Founder voice)"
            className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!newName.trim() || create.isPending}
            onClick={() => create.mutate(newName.trim())}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {personas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No personas yet. Add one, then paste writing samples below.
          </p>
        ) : (
          <ul className="space-y-2">
            {personas.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-elev px-3 py-2"
              >
                <input
                  defaultValue={p.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== p.name) rename.mutate({ id: p.id, name: v });
                  }}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                {activeId === p.id ? (
                  <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => activate.mutate(p.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Make active
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => {
                    if (confirm(`Delete persona "${p.name}"?`)) remove.mutate(p.id);
                  }}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeId ? (
        <VoiceProfileEditor personaId={activeId} />
      ) : (
        <p className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Pick an active persona to edit voice samples and directives.
        </p>
      )}
    </div>
  );
}

function VoiceProfileEditor({ personaId }: { personaId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getVoiceProfile);
  const saveFn = useServerFn(upsertVoiceProfile);

  const { data } = useQuery({
    queryKey: ["voice", personaId],
    queryFn: () => getFn({ data: { personaId } }),
  });

  const [samples, setSamples] = useState<Sample[]>([]);
  const [directives, setDirectives] = useState<string[]>([]);
  const [newSample, setNewSample] = useState("");
  const [newDirective, setNewDirective] = useState("");

  useEffect(() => {
    setSamples(Array.isArray(data?.samples) ? (data?.samples as Sample[]) : []);
    setDirectives(
      Array.isArray(data?.directives) ? (data?.directives as string[]) : [],
    );
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: { samples: Sample[]; directives: string[] }) =>
      saveFn({ data: { personaId, ...payload } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice", personaId] }),
  });

  function commit(next: { samples?: Sample[]; directives?: string[] }) {
    const payload = {
      samples: next.samples ?? samples,
      directives: next.directives ?? directives,
    };
    if (next.samples) setSamples(next.samples);
    if (next.directives) setDirectives(next.directives);
    save.mutate(payload);
  }

  return (
    <>
      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Writing samples</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Paste a few things you've written that sound like you. Eve studies these for cadence and word choice.
        </p>

        <div className="mb-3">
          <textarea
            value={newSample}
            onChange={(e) => setNewSample(e.target.value)}
            placeholder="Paste a post, tweet, email — anything you wrote."
            rows={4}
            className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!newSample.trim()}
            onClick={() => {
              const next = [...samples, { text: newSample.trim() }];
              setNewSample("");
              commit({ samples: next });
            }}
            className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Add sample
          </button>
        </div>

        {samples.length === 0 ? (
          <p className="text-xs text-muted-foreground">No samples yet.</p>
        ) : (
          <ul className="space-y-2">
            {samples.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-surface-elev px-3 py-2 text-sm"
              >
                <p className="flex-1 whitespace-pre-line text-foreground/90">{s.text}</p>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => commit({ samples: samples.filter((_, j) => j !== i) })}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Directives</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Hard rules Eve must follow (e.g. "Never use emoji", "Prefer active voice").
        </p>

        <div className="mb-3 flex gap-2">
          <input
            value={newDirective}
            onChange={(e) => setNewDirective(e.target.value)}
            placeholder="Add a rule…"
            className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!newDirective.trim()}
            onClick={() => {
              const next = [...directives, newDirective.trim()];
              setNewDirective("");
              commit({ directives: next });
            }}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {directives.length === 0 && (
            <p className="text-xs text-muted-foreground">No directives yet.</p>
          )}
          {directives.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => commit({ directives: directives.filter((_, j) => j !== i) })}
              title="Click to remove"
            >
              <Pill size="sm" variant="ghost">
                {d}
                <Trash2 className="h-3 w-3" />
              </Pill>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
