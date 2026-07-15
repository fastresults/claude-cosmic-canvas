import { useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { runDeepResearch } from "@/lib/knowledge/research.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
  domainId?: string | null;
  domainName?: string;
};

export function ResearchSheet({
  open,
  onOpenChange,
  profileId,
  domainId,
  domainName,
}: Props) {
  const qc = useQueryClient();
  const researchFn = useServerFn(runDeepResearch);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      researchFn({
        data: {
          topic: topic.trim(),
          domain_id: domainId ?? null,
          domain_name: domainName,
          profile_id: profileId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      setTopic("");
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="AI deep research">
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-surface-elev p-3 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
          <div>
            Eve will research this topic{domainName ? ` for ${domainName}` : ""} and save a
            structured brief with key facts, context, and sources.
          </div>
        </div>
        <Textarea
          autoFocus
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Latest research on activation-energy metrics in PLG onboarding"
          rows={4}
          className="border-border bg-surface"
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
            disabled={topic.trim().length < 3 || submit.isPending}
            onClick={() => submit.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Researching…" : "Run research"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
