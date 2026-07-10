import { useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Pill } from "@/components/primitives/Pill";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
  domainId?: string | null;
};

export function PasteSheet({ open, onOpenChange, profileId, domainId }: Props) {
  const qc = useQueryClient();
  const ingestFn = useServerFn(ingestEntry);
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId ?? null,
          source_type: "paste",
          content: content.trim(),
          tags,
          kind: "note",
          meta: {},
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      setContent("");
      setTags([]);
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Paste a note">
      <div className="space-y-3">
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste bio, article, transcript, notes…"
          rows={8}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
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
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tag.trim()) {
                e.preventDefault();
                setTags((s) => Array.from(new Set([...s, tag.trim()])));
                setTag("");
              }
            }}
            placeholder="Add tag + Enter"
            className="flex-1 min-w-[8rem] rounded-md border border-border bg-surface px-2 py-1 text-xs"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!content.trim() || submit.isPending}
            onClick={() => submit.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
