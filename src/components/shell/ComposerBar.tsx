import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { contentDraft } from "@/lib/content/content.functions";

export function ComposerBar() {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const draftFn = useServerFn(contentDraft);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (prompt: string) =>
      draftFn({ data: { prompt, format: "post" } }),
    onSuccess: () => {
      setValue("");
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const p = value.trim();
    if (p.length < 2 || mutation.isPending) return;
    mutation.mutate(p);
  }

  return (
    <form
      onSubmit={submit}
      className="fixed inset-x-0 z-30 border-t border-border frosted"
      style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={mutation.isPending}
          placeholder={
            mutation.isPending
              ? "Eve is thinking…"
              : listening
                ? "Listening…"
                : "Hold to speak, or type…"
          }
          className="flex-1 rounded-full border border-input bg-surface-elev px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent disabled:opacity-60"
        />
        {value.trim().length > 1 ? (
          <button
            type="submit"
            disabled={mutation.isPending}
            aria-label="Send"
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent text-accent-foreground amber-glow disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        ) : (
          <HoldToSpeakButton
            onStart={() => setListening(true)}
            onEnd={() => setListening(false)}
          />
        )}
      </div>
    </form>
  );
}
