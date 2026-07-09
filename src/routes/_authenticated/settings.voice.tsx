import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Pill } from "@/components/primitives/Pill";
import { useConfirm } from "@/components/confirm-dialog";
import {
  Check,
  Copy,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  BookOpen,
  Search,
} from "lucide-react";
import {
  adoptSystemVoice,
  analyzeOwnVoice,
  createVoiceProfile,
  deleteVoiceProfile,
  duplicateVoiceProfile,
  getActiveVoice,
  listSystemVoices,
  listVoiceProfiles,
  setActiveVoice,
  setDefaultVoiceProfile,
} from "@/lib/voice/voice.functions";

export const Route = createFileRoute("/_authenticated/settings/voice")({
  component: VoiceList,
});

function VoiceList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listVoiceProfiles);
  const activeFn = useServerFn(getActiveVoice);
  const createFn = useServerFn(createVoiceProfile);
  const setActiveFn = useServerFn(setActiveVoice);
  const setDefaultFn = useServerFn(setDefaultVoiceProfile);
  const dupFn = useServerFn(duplicateVoiceProfile);
  const delFn = useServerFn(deleteVoiceProfile);

  const { data: voices = [] } = useQuery({
    queryKey: ["voice-profiles"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: active } = useQuery({
    queryKey: ["voice-active"],
    queryFn: () => activeFn(),
  });

  const [q, setQ] = useState("");
  const [openSheet, setOpenSheet] = useState<null | "menu" | "analyze">(null);

  const confirm = useConfirm();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["voice-profiles"] });
    qc.invalidateQueries({ queryKey: ["voice-active"] });
  };

  const create = useMutation({
    mutationFn: (name: string) =>
      createFn({
        data: {
          name,
          vocabulary_preferred: [],
          vocabulary_avoid: [],
          samples: [],
          formality: 50,
          humor: 50,
          technicality: 50,
          conciseness: 50,
          source: "scratch",
        },
      }),
    onSuccess: (row) => {
      invalidate();
      navigate({
        to: "/settings/voice/$id",
        params: { id: row.id },
      });
    },
  });

  const setActive = useMutation({
    mutationFn: (id: string) => setActiveFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const filtered = voices.filter((v) =>
    q ? v.name.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <SettingsPageHeader
        title="Voice & Style"
        description="Your written voices. Every AI generation is gated by the voice you activate here."
      />

      {active ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Active voice: <strong className="font-semibold">{active.name}</strong>
          </span>
          <Link
            to="/settings/voice/$id"
            params={{ id: active.id }}
            className="text-accent underline-offset-2 hover:underline"
          >
            Tune
          </Link>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          No active voice. AI generations are blocked until you pick one.
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search voices…"
            className="w-full rounded-md border border-input bg-surface-elev py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpenSheet("menu")}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No voices yet. Tap <strong>New</strong> to analyze your writing, research
          a communicator, or start from scratch.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => {
            const isActive = active?.id === v.id;
            return (
              <li
                key={v.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/settings/voice/$id"
                    params={{ id: v.id }}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {v.name}
                      </span>
                      {v.is_default && (
                        <Pill size="sm" variant="ghost">
                          <Star className="h-3 w-3" /> default
                        </Pill>
                      )}
                      {isActive && (
                        <Pill size="sm" variant="ghost">
                          <Check className="h-3 w-3" /> active
                        </Pill>
                      )}
                    </div>
                    {v.tone && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.tone}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      {v.category && <span>{v.category}</span>}
                      <span>F{v.formality} · H{v.humor} · T{v.technicality} · C{v.conciseness}</span>
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => setActive.mutate(v.id)}
                        className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent"
                      >
                        Use
                      </button>
                    )}
                    {!v.is_default && (
                      <button
                        type="button"
                        onClick={() => setDefault.mutate(v.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Default
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <button
                    type="button"
                    aria-label="Duplicate"
                    onClick={() => dup.mutate(v.id)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={async () => {
                      if (await confirm({ title: `Delete voice "${v.name}"?`, destructive: true })) del.mutate(v.id);
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PersonaLibrary
        onAdopted={(id) => {
          invalidate();
          navigate({ to: "/settings/voice/$id", params: { id } });
        }}
      />


      {openSheet === "menu" && (
        <NewVoiceSheet
          onClose={() => setOpenSheet(null)}
          onScratch={() => {
            const name = prompt("Name this voice");
            if (name?.trim()) {
              setOpenSheet(null);
              create.mutate(name.trim());
            }
          }}
          onAnalyze={() => setOpenSheet("analyze")}
        />
      )}
      {openSheet === "analyze" && (
        <AnalyzeSheet
          onClose={() => setOpenSheet(null)}
          onCreated={(id) => {
            setOpenSheet(null);
            invalidate();
            navigate({ to: "/settings/voice/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

function NewVoiceSheet({
  onClose,
  onScratch,
  onAnalyze,
}: {
  onClose: () => void;
  onScratch: () => void;
  onAnalyze: () => void;
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"actions" | "library">("actions");
  const listSysFn = useServerFn(listSystemVoices);
  const adoptFn = useServerFn(adoptSystemVoice);
  const qc = useQueryClient();
  const { data: sys = [] } = useQuery({
    queryKey: ["system-voices"],
    queryFn: () => listSysFn({ data: {} }),
    enabled: tab === "library",
  });
  const adopt = useMutation({
    mutationFn: (id: string) => adoptFn({ data: { id } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["voice-profiles"] });
      onClose();
      navigate({ to: "/settings/voice/$id", params: { id: row.id } });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">New voice</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
        </div>
        <div className="mb-3 flex gap-1 rounded-md bg-surface-elev p-0.5">
          <button
            onClick={() => setTab("actions")}
            className={`flex-1 rounded px-2 py-1 text-xs ${
              tab === "actions" ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            AI first
          </button>
          <button
            onClick={() => setTab("library")}
            className={`flex-1 rounded px-2 py-1 text-xs ${
              tab === "library" ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            Persona library
          </button>
        </div>

        {tab === "actions" ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onAnalyze}
              className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-elev"
            >
              <Wand2 className="mt-0.5 h-4 w-4 text-accent" />
              <div>
                <div className="text-sm font-medium">Analyze my writing</div>
                <div className="text-xs text-muted-foreground">
                  Paste a sample; Eve extracts your voice profile.
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={onScratch}
              className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-elev"
            >
              <Plus className="mt-0.5 h-4 w-4 text-accent" />
              <div>
                <div className="text-sm font-medium">From scratch</div>
                <div className="text-xs text-muted-foreground">
                  Empty profile you'll tune manually.
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {sys.length === 0 && (
              <p className="p-3 text-center text-xs text-muted-foreground">
                No system voices seeded yet.
              </p>
            )}
            {sys.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={adopt.isPending}
                onClick={() => adopt.mutate(s.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-elev"
              >
                <BookOpen className="mt-0.5 h-4 w-4 text-accent" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  {s.tagline && (
                    <div className="truncate text-xs text-muted-foreground">
                      {s.tagline}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function PersonaLibrary({ onAdopted }: { onAdopted: (id: string) => void }) {
  const listSysFn = useServerFn(listSystemVoices);
  const adoptFn = useServerFn(adoptSystemVoice);
  const { data: sys = [] } = useQuery({
    queryKey: ["system-voices"],
    queryFn: () => listSysFn({ data: {} }),
    staleTime: 5 * 60_000,
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const adopt = useMutation({
    mutationFn: (id: string) => adoptFn({ data: { id } }),
    onSuccess: (row) => onAdopted(row.id),
  });

  const filtered = sys.filter((s) => {
    if (cat !== "all" && s.category !== cat) return false;
    if (!q) return true;
    const hay = `${s.name} ${s.profession ?? ""} ${s.tagline ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  const grouped = new Map<string, typeof filtered>();
  for (const cid of CATEGORY_ORDER) grouped.set(cid, []);
  for (const s of filtered) {
    const key = s.category && grouped.has(s.category) ? s.category : "other";
    grouped.get(key)!.push(s);
  }
  const cats = ["all", ...CATEGORY_ORDER];

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Persona library</h2>
        <span className="text-[10px] text-muted-foreground">
          {sys.length} curated voices
        </span>
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search personas…"
          className="w-full rounded-md border border-input bg-surface-elev py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              cat === c
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {c === "all" ? "All" : CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No personas match that filter.
        </p>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map((cid) => {
            const rows = grouped.get(cid) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={cid}>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cid]} · {rows.length}
                </div>
                <ul className="space-y-1.5">
                  {rows.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        {s.profession && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {s.profession}
                          </div>
                        )}
                        {s.tagline && (
                          <div className="mt-0.5 text-[11px] italic text-foreground/70">
                            {s.tagline}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={adopt.isPending}
                        onClick={() => adopt.mutate(s.id)}
                        className="h-11 shrink-0 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-50"
                      >
                        Adopt
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


function AnalyzeSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const analyzeFn = useServerFn(analyzeOwnVoice);
  const createFn = useServerFn(createVoiceProfile);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");

  const run = async () => {
    if (text.trim().length < 20) return;
    setStatus("analyzing");
    try {
      const result = await analyzeFn({ data: { samples: [text.trim()] } });
      if (result.fallback || !("profile" in result)) {
        setStatus("error");
        return;
      }
      const p = result.profile;
      const created = await createFn({
        data: {
          name: name.trim() || p.name || "My voice",
          tone: p.tone,
          guidelines: p.guidelines,
          vocabulary_preferred: p.vocabulary_preferred,
          vocabulary_avoid: p.vocabulary_avoid,
          formality: p.formality,
          humor: p.humor,
          technicality: p.technicality,
          conciseness: p.conciseness,
          samples: [{ text: text.trim(), source: "analyze" }, ...(p.samples ?? [])].slice(
            0,
            5,
          ),
          source: "analyze",
        },
      });
      onCreated(created.id);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Analyze my writing</h3>
          <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Voice name (optional)"
          className="mb-2 w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste a sample of your writing (a post, email, tweet — 100+ words works best)."
          className="w-full rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {status === "error" && (
          <p className="mt-2 text-xs text-destructive">
            Couldn't analyze that sample. Try a longer one.
          </p>
        )}
        <button
          type="button"
          disabled={text.trim().length < 20 || status === "analyzing"}
          onClick={run}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {status === "analyzing" ? "Analyzing…" : "Analyze & create"}
        </button>
      </div>
    </div>
  );
}
