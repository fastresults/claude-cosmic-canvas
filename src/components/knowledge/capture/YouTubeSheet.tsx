import { useEffect, useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Youtube } from "lucide-react";
import { ingestYouTube } from "@/lib/knowledge/youtube.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
  domainId?: string | null;
  initialUrl?: string;
};

export function YouTubeSheet({ open, onOpenChange, profileId, domainId, initialUrl }: Props) {
  const qc = useQueryClient();
  const ingestFn = useServerFn(ingestYouTube);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialUrl) setUrl(initialUrl);
  }, [open, initialUrl]);

  const submit = useMutation({
    mutationFn: () =>
      ingestFn({
        data: {
          url: url.trim(),
          domain_id: domainId ?? null,
          profile_id: profileId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      setUrl("");
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Add a YouTube video">
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-elev p-3 text-xs text-muted-foreground">
          <Youtube className="h-4 w-4 text-accent" />
          Paste a YouTube URL — we'll fetch the transcript and save it as source material.
        </div>
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://www.youtube.com/watch?v=…"
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
            {submit.isPending ? "Transcribing…" : "Save video"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
