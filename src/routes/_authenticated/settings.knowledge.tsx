import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { Pill } from "@/components/primitives/Pill";
import { Trash2, Plus } from "lucide-react";
import {
  addDomain,
  addKnowledge,
  deleteDomain,
  deleteKnowledge,
  listDomains,
  listKnowledge,
} from "@/lib/settings/settings.functions";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/knowledge")({
  component: KnowledgeSettings,
});

const KIND_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  resume: "Resume",
  note: "Note",
  url: "URL",
};

function KnowledgeSettings() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Knowledge & Domains"
        description="Paste your LinkedIn About, your resume, links, or notes. Eve uses these as source material — and never claims them as facts unless you say so."
      />
      <DomainsSection />
      <KnowledgeSection />
    </div>
  );
}

function DomainsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDomains);
  const addFn = useServerFn(addDomain);
  const deleteFn = useServerFn(deleteDomain);

  const { data: domains = [] } = useQuery({
    queryKey: ["domains"],
    queryFn: () => listFn(),
  });

  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (name: string) => addFn({ data: { name } }),
    onSuccess: () => {
      setValue("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed to add"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Domains of expertise</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        One or two words each — the topics you naturally write about.
      </p>

      <div className="mb-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. AI safety, product ops, cardiology"
          className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!value.trim() || add.isPending}
          onClick={() => add.mutate(value.trim())}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}

      <div className="flex flex-wrap gap-2">
        {domains.length === 0 && (
          <p className="text-xs text-muted-foreground">No domains yet.</p>
        )}
        {domains.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => remove.mutate(d.id)}
            title="Click to remove"
          >
            <Pill size="sm" variant="ghost">
              {d.name}
              <Trash2 className="h-3 w-3" />
            </Pill>
          </button>
        ))}
      </div>
    </section>
  );
}

function KnowledgeSection() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const listFn = useServerFn(listKnowledge);
  const addFn = useServerFn(addKnowledge);
  const deleteFn = useServerFn(deleteKnowledge);

  const { data: entries = [] } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => listFn(),
  });

  const [kind, setKind] = useState<"linkedin" | "resume" | "note" | "url">("note");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: { kind, title, source_url: url || undefined, content: content || undefined },
      }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setContent("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed to add"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return (
    <>
      <section className="mb-6 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add knowledge</h2>
        <div className="grid gap-3">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "linkedin" | "resume" | "note" | "url")
              }
              className="rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="note">Note</option>
              <option value="linkedin">LinkedIn</option>
              <option value="resume">Resume</option>
              <option value="url">URL</option>
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. LinkedIn About, Resume 2026)"
              className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Source URL (optional)"
            className="rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Paste content — resume text, LinkedIn About, notes…"
            className="rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div>
            <button
              type="button"
              disabled={!title.trim() || add.isPending}
              onClick={() => add.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {add.isPending ? "Adding…" : "Add entry"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Your entries ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing added yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-md border border-border bg-surface-elev px-3 py-2"
              >
                <span className="mt-0.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase text-accent">
                  {KIND_LABELS[e.kind] ?? e.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{e.title}</div>
                  {e.source_url && (
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[11px] text-brain-teal hover:underline"
                    >
                      {e.source_url}
                    </a>
                  )}
                  {e.content && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {e.content}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={async () => {
                    if (await confirm({ title: `Delete "${e.title}"?`, destructive: true })) remove.mutate(e.id);
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
    </>
  );
}
