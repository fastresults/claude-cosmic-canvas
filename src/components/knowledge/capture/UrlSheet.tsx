import { useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { scrapeUrl } from "@/lib/knowledge/parsing.functions";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
};

export function UrlSheet({ open, onOpenChange, profileId }: Props) {
  const qc = useQueryClient();
  const scrapeFn = useServerFn(scrapeUrl);
  const ingestFn = useServerFn(ingestEntry);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const scraped = await scrapeFn({ data: { url: url.trim() } });
      return ingestFn({
        data: {
          profile_id: profileId,
          source_type: "url",
          title: scraped.title ?? url,
          content: `${scraped.title ?? ""}\n\n${scraped.markdown}`.trim(),
          source_url: url,
          tags: [],
          kind: "url",
          meta: {
            description: scraped.description,
            image: scraped.image,
          },
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      setUrl("");
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Save a URL">
      <div className="space-y-3">
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
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
            disabled={!url.trim() || submit.isPending}
            onClick={() => submit.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Fetching…" : "Save"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
