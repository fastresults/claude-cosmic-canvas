import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, ArrowUp } from "lucide-react";

type Props = {
  placeholder?: string;
  contextPreamble?: string;
};

export function AskEveBar({ placeholder = "Ask Eve about this view…", contextPreamble }: Props) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const composed = contextPreamble ? `${contextPreamble}\n\n${trimmed}` : trimmed;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("eve:seed-prompt", composed);
    }
    setValue("");
    void navigate({ to: "/" });
  };

  return (
    <form
      onSubmit={submit}
      className="pointer-events-auto sticky bottom-0 z-20 mx-auto flex w-full max-w-2xl items-center gap-2 border-t border-border/60 bg-background/85 px-3 py-2 backdrop-blur"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-accent" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        aria-label="Ask Eve"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
}
