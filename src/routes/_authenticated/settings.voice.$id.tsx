import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Sparkles, Trash2, X } from "lucide-react";
import {
  deleteVoiceProfile,
  generateVoiceSamples,
  getVoiceProfile,
  setActiveVoice,
  setDefaultVoiceProfile,
  updateVoiceProfile,
} from "@/lib/voice/voice.functions";
import { useConfirm } from "@/components/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings/voice/$id")({
  component: VoiceEditor,
});

type Sample = { text: string; source?: string };

function VoiceEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const getFn = useServerFn(getVoiceProfile);
  const saveFn = useServerFn(updateVoiceProfile);
  const samplesFn = useServerFn(generateVoiceSamples);
  const setActiveFn = useServerFn(setActiveVoice);
  const setDefaultFn = useServerFn(setDefaultVoiceProfile);
  const delFn = useServerFn(deleteVoiceProfile);

  const { data: profile } = useQuery({
    queryKey: ["voice-profile", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [form, setForm] = useState({
    name: "",
    tone: "",
    guidelines: "",
    formality: 50,
    humor: 50,
    technicality: 50,
    conciseness: 50,
    preferred: [] as string[],
    avoid: [] as string[],
    samples: [] as Sample[],
  });
  const [prefInput, setPrefInput] = useState("");
  const [avoidInput, setAvoidInput] = useState("");
  const [newSample, setNewSample] = useState("");
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name ?? "",
      tone: profile.tone ?? "",
      guidelines: profile.guidelines ?? "",
      formality: profile.formality ?? 50,
      humor: profile.humor ?? 50,
      technicality: profile.technicality ?? 50,
      conciseness: profile.conciseness ?? 50,
      preferred: profile.vocabulary_preferred ?? [],
      avoid: profile.vocabulary_avoid ?? [],
      samples: Array.isArray(profile.samples) ? (profile.samples as Sample[]) : [],
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id,
          name: form.name,
          tone: form.tone || null,
          guidelines: form.guidelines || null,
          vocabulary_preferred: form.preferred,
          vocabulary_avoid: form.avoid,
          formality: form.formality,
          humor: form.humor,
          technicality: form.technicality,
          conciseness: form.conciseness,
          samples: form.samples,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profile", id] });
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
    },
  });

  const runPreview = async () => {
    setPreviewing(true);
    try {
      // Save first so preview reflects sliders
      await save.mutateAsync();
      const res = await samplesFn({ data: { voiceProfileId: id } });
      setPreview(res.samples ?? []);
    } finally {
      setPreviewing(false);
    }
  };

  const setActive = useMutation({
    mutationFn: () => setActiveFn({ data: { id } }),
    onMutate: async () => {
      // Optimistic: the pill reflects the pick instantly, before the server replies.
      await qc.cancelQueries({ queryKey: ["voice-active"] });
      const previous = qc.getQueryData(["voice-active"]);
      if (profile) qc.setQueryData(["voice-active"], profile);
      return { previous };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(["voice-active"], ctx?.previous);
      toast.error(e instanceof Error ? e.message : "Couldn't switch voice");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["voice-active"] }),
  });
  const setDefault = useMutation({
    mutationFn: () => setDefaultFn({ data: { id } }),
    onSuccess: () => {
      // Default now also flips active on the server — refresh every surface.
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      qc.invalidateQueries({ queryKey: ["voice-active"] });
      qc.invalidateQueries({ queryKey: ["voice-profile", id] });
    },
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      navigate({ to: "/settings/voice" });
    },
  });

  if (!profile) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-32 pt-4">
      <Link
        to="/settings/voice"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voices
      </Link>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setDefault.mutate()}
          disabled={setDefault.isPending || profile.is_default}
          className="flex-1 rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground disabled:opacity-60"
        >
          <Sparkles className="mr-1 inline h-3.5 w-3.5" />
          {profile.is_default
            ? "Default voice"
            : setDefault.isPending
              ? "Setting…"
              : "Set as default voice"}
        </button>
        <button
          type="button"
          onClick={() => setActive.mutate()}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
          title="Use just for this session, without changing your default"
        >
          Use once
        </button>
      </div>

      {/* Name & tone */}
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground">Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <label className="mt-3 block text-xs text-muted-foreground">Tone</label>
        <input
          value={form.tone}
          onChange={(e) => setForm({ ...form, tone: e.target.value })}
          placeholder="Direct, warm, a bit contrarian."
          className="mt-1 w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </section>

      {/* Sliders */}
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Style</h3>
        {(
          [
            ["formality", "Formality"],
            ["humor", "Humor"],
            ["technicality", "Technicality"],
            ["conciseness", "Conciseness"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="mb-2 block">
            <div className="flex justify-between text-xs">
              <span>{label}</span>
              <span className="text-muted-foreground">{form[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={form[key]}
              onChange={(e) =>
                setForm({ ...form, [key]: Number(e.target.value) })
              }
              className="w-full accent-accent"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={runPreview}
          disabled={previewing}
          className="mt-2 rounded-md border border-accent/50 px-3 py-1.5 text-xs text-accent"
        >
          {previewing ? "Generating…" : "Preview tone"}
        </button>
        {preview && (
          <div className="mt-2 space-y-1.5">
            {preview.map((s, i) => (
              <p
                key={i}
                className="rounded border border-border bg-surface-elev p-2 text-xs italic text-foreground/80"
              >
                {s}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Guidelines */}
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Guidelines</h3>
        <Textarea
          rows={5}
          value={form.guidelines}
          onChange={(e) => setForm({ ...form, guidelines: e.target.value })}
          placeholder="Bullet rules Eve must follow."
          className="border-input bg-surface-elev focus-visible:border-accent"
        />
      </section>

      {/* Vocabulary */}
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Vocabulary</h3>
        <VocabList
          label="Prefer"
          items={form.preferred}
          input={prefInput}
          setInput={setPrefInput}
          onAdd={(w) =>
            setForm({
              ...form,
              preferred: dedupeExclusive([...form.preferred, w], form.avoid).preferred,
              avoid: dedupeExclusive([...form.preferred, w], form.avoid).avoid,
            })
          }
          onRemove={(i) =>
            setForm({ ...form, preferred: form.preferred.filter((_, j) => j !== i) })
          }
        />
        <div className="my-3 h-px bg-border" />
        <VocabList
          label="Avoid"
          items={form.avoid}
          input={avoidInput}
          setInput={setAvoidInput}
          onAdd={(w) =>
            setForm({
              ...form,
              preferred: dedupeExclusive(form.preferred, [...form.avoid, w]).preferred,
              avoid: dedupeExclusive(form.preferred, [...form.avoid, w]).avoid,
            })
          }
          onRemove={(i) =>
            setForm({ ...form, avoid: form.avoid.filter((_, j) => j !== i) })
          }
        />
      </section>

      {/* Samples */}
      <section className="mb-4 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Writing samples</h3>
        <Textarea
          rows={4}
          value={newSample}
          onChange={(e) => setNewSample(e.target.value)}
          placeholder="Paste something you wrote."
          className="border-input bg-surface-elev focus-visible:border-accent"
        />
        <button
          type="button"
          disabled={!newSample.trim() || form.samples.length >= 5}
          onClick={() => {
            setForm({
              ...form,
              samples: [...form.samples, { text: newSample.trim() }].slice(0, 5),
            });
            setNewSample("");
          }}
          className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Add sample ({form.samples.length}/5)
        </button>
        <ul className="mt-3 space-y-2">
          {form.samples.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-border bg-surface-elev p-2 text-xs"
            >
              <p className="flex-1 whitespace-pre-line">{s.text}</p>
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    samples: form.samples.filter((_, j) => j !== i),
                  })
                }
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="mb-8 flex justify-between">
        <button
          type="button"
          onClick={async () => {
            if (await confirm({ title: `Delete voice "${form.name}"?`, destructive: true })) del.mutate();
          }}
          className="text-xs text-destructive"
        >
          Delete voice
        </button>
        <Link
          to="/settings/voice/$id/learned"
          params={{ id }}
          className="text-xs text-accent underline-offset-2 hover:underline"
        >
          Learned preferences →
        </Link>
      </div>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-xl px-4">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-md bg-primary px-3 py-3 text-sm font-medium text-primary-foreground shadow-lg disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save voice"}
        </button>
      </div>
    </div>
  );
}

function dedupeExclusive(preferred: string[], avoid: string[]) {
  const p = new Set<string>();
  const cleanP: string[] = [];
  for (const w of preferred) {
    const k = w.trim();
    if (!k) continue;
    if (p.has(k.toLowerCase())) continue;
    p.add(k.toLowerCase());
    cleanP.push(k);
  }
  const a = new Set<string>();
  const cleanA: string[] = [];
  for (const w of avoid) {
    const k = w.trim();
    if (!k) continue;
    const lk = k.toLowerCase();
    if (a.has(lk) || p.has(lk)) continue;
    a.add(lk);
    cleanA.push(k);
  }
  return { preferred: cleanP, avoid: cleanA };
}

function VocabList({
  label,
  items,
  input,
  setInput,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  input: string;
  setInput: (s: string) => void;
  onAdd: (w: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              onAdd(input.trim());
              setInput("");
            }
          }}
          placeholder="Add and press Enter"
          className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {items.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-elev px-2 py-0.5 text-[11px]"
          >
            {w}
            <button
              onClick={() => onRemove(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
