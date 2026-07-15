import { useEffect, useRef, useState } from "react";
import { Pencil, Sparkles, Loader2, Check, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestDraftTitle } from "@/lib/create/create.functions";

type Section = { heading: string | null; body: string };

type Props = {
  title: string | null;
  draftId?: string | null;
  // In-memory sections (used when the draft isn't persisted yet).
  sections?: Section[];
  onSave: (nextTitle: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
};

export function DraftTitleHeader({
  title,
  draftId,
  sections,
  onSave,
  disabled,
  placeholder = "Name this draft",
}: Props) {
  const suggestFn = useServerFn(suggestDraftTitle);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setValue(title ?? "");
  }, [title, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const canSuggest = !!draftId || (sections && sections.length > 0);

  async function commit() {
    const next = value.trim();
    if (!next.length) {
      // Revert — names are required.
      setValue(title ?? "");
      setEditing(false);
      return;
    }
    if (next === (title ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  }

  async function onSuggest() {
    if (!canSuggest || suggesting) return;
    setSuggesting(true);
    setError(null);
    try {
      const payload = draftId
        ? { data: { draftId } }
        : { data: { sections: sections! } };
      const res = await suggestFn(payload);
      setValue(res.title);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suggest a title");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void commit(); }
              else if (e.key === "Escape") { setEditing(false); setValue(title ?? ""); }
            }}
            maxLength={120}
            placeholder={placeholder}
            disabled={disabled || saving}
            className="min-w-0 flex-1 border-b border-primary/50 bg-transparent font-display text-xl text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        ) : (
          <button
            type="button"
            onClick={() => !disabled && setEditing(true)}
            className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
            aria-label="Rename draft"
          >
            <span
              className={
                title
                  ? "truncate font-display text-xl text-foreground"
                  : "truncate font-display text-xl text-muted-foreground/70"
              }
            >
              {title ?? placeholder}
            </span>
            <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        {editing ? (
          <>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void commit()}
              disabled={saving || !value.trim()}
              aria-label="Save name"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setEditing(false); setValue(title ?? ""); }}
              aria-label="Cancel rename"
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={onSuggest}
          disabled={!canSuggest || suggesting || disabled}
          aria-label="Suggest a title from the content"
          title="Suggest a title from the content"
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground hover:text-primary disabled:opacity-40"
        >
          {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
