import { EveSheet } from "@/components/primitives/EveSheet";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateEntry, archiveEntry, pinEntry } from "@/lib/knowledge/knowledge.functions";
import { useState, useEffect } from "react";
import type { KnowledgeEntry } from "./shared";
import { SOURCE_LABELS } from "./shared";
import { Pill } from "@/components/primitives/Pill";
import { Pin, Archive, ExternalLink } from "lucide-react";

type Props = {
  entry: KnowledgeEntry | null;
  onOpenChange: (v: boolean) => void;
};

type Structured = {
  full_name?: string;
  headline?: string;
  roles?: Array<{ title: string; company: string; start: string | null; end: string | null }>;
  skills?: string[];
};

export function EntryDetailSheet({ entry, onOpenChange }: Props) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateEntry);
  const archiveFn = useServerFn(archiveEntry);
  const pinFn = useServerFn(pinEntry);

  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [useNext, setUseNext] = useState(true);

  useEffect(() => {
    if (entry) {
      setTitle(entry.title ?? "");
      setTags(entry.tags ?? []);
      setUseNext(entry.use_in_next_gen);
    }
  }, [entry]);

  const structured =
    entry?.meta && typeof entry.meta === "object" && "structured" in (entry.meta as object)
      ? ((entry.meta as { structured: Structured }).structured)
      : null;

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: { id: entry!.id, title, tags, use_in_next_gen: useNext },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      onOpenChange(false);
    },
  });

  const doArchive = useMutation({
    mutationFn: () => archiveFn({ data: { id: entry!.id, archived: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      onOpenChange(false);
    },
  });

  const togglePin = useMutation({
    mutationFn: () => pinFn({ data: { id: entry!.id, pinned: !entry!.pinned } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", "entries"] }),
  });

  return (
    <EveSheet
      open={!!entry}
      onOpenChange={onOpenChange}
      title={entry ? SOURCE_LABELS[entry.source_type] ?? "Entry" : ""}
    >
      {entry && (
        <div className="space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium"
          />

          {entry.source_url && (
            <a
              href={entry.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent"
            >
              <ExternalLink className="h-3 w-3" /> {entry.source_url}
            </a>
          )}

          {structured && (
            <div className="rounded-md border border-border bg-surface-elev p-3 text-sm">
              {structured.headline && (
                <p className="text-xs italic text-muted-foreground">{structured.headline}</p>
              )}
              {structured.roles && structured.roles.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Roles</div>
                  <ul className="mt-1 space-y-1">
                    {structured.roles.slice(0, 5).map((r, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium">{r.title}</span> — {r.company}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {structured.skills && structured.skills.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Skills</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {structured.skills.slice(0, 12).map((s) => (
                      <span key={s} className="rounded-pill bg-surface px-2 py-0.5 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Content</div>
            <div className="max-h-96 overflow-y-auto rounded-md border border-border bg-surface p-3">
              <Markdown>{entry.content}</Markdown>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs uppercase text-muted-foreground">Tags</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((t) => (
                <Pill
                  key={t}
                  size="sm"
                  variant="ghost"
                  onClick={() => setTags((s) => s.filter((x) => x !== t))}
                >
                  {t} ×
                </Pill>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    setTags((s) => Array.from(new Set([...s, tagInput.trim()])));
                    setTagInput("");
                  }
                }}
                placeholder="Add"
                className="min-w-[6rem] flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-md border border-border bg-surface-elev px-3 py-2 text-sm">
            <span>Use in next generation</span>
            <input
              type="checkbox"
              checked={useNext}
              onChange={(e) => setUseNext(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex gap-1.5">
              <Pill size="sm" variant="outline" onClick={() => togglePin.mutate()}>
                <Pin className="h-3.5 w-3.5" /> {entry.pinned ? "Unpin" : "Pin"}
              </Pill>
              <Pill size="sm" variant="outline" onClick={() => doArchive.mutate()}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </Pill>
            </div>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </EveSheet>
  );
}
