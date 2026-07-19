import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Use `const prompt = usePrompt()` instead of window.prompt so every
// text-input "system prompt" renders through our themed AlertDialog.

export type PromptOptions = {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  maxLength?: number;
  inputType?: "text" | "url" | "email";
  validate?: (value: string) => string | null;
};

type Pending = {
  options: PromptOptions;
  resolve: (value: string | null) => void;
};

const PromptContext = React.createContext<
  ((options: PromptOptions) => Promise<string | null>) | null
>(null);

export function PromptDialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<Pending[]>([]);
  const current = queue[0];
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (current) {
      setValue(current.options.defaultValue ?? "");
      setError(null);
      setOpen(true);
    }
  }, [current]);

  const promptFn = React.useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setQueue((q) => [...q, { options, resolve }]);
    });
  }, []);

  const settle = (v: string | null) => {
    if (!current) return;
    current.resolve(v);
    setOpen(false);
    setTimeout(() => setQueue((q) => q.slice(1)), 150);
  };

  const submit = () => {
    if (!current) return;
    const trimmed = value.trim();
    if (current.options.required && !trimmed) {
      setError("Required");
      return;
    }
    if (current.options.validate) {
      const err = current.options.validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    settle(trimmed);
  };

  const opts = current?.options;

  return (
    <PromptContext.Provider value={promptFn}>
      {children}
      <AlertDialog
        open={open && !!current}
        onOpenChange={(next) => {
          if (!next) settle(null);
        }}
      >
        <AlertDialogContent>
          {opts ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{opts.title}</AlertDialogTitle>
                {opts.description ? (
                  <AlertDialogDescription>{opts.description}</AlertDialogDescription>
                ) : null}
              </AlertDialogHeader>
              <div className="space-y-2">
                {opts.label ? (
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {opts.label}
                  </label>
                ) : null}
                <input
                  autoFocus
                  type={opts.inputType ?? "text"}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={opts.placeholder}
                  maxLength={opts.maxLength}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : null}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => settle(null)}>
                  {opts.cancelLabel ?? "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  {opts.confirmLabel ?? "OK"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </PromptContext.Provider>
  );
}

export function usePrompt() {
  const ctx = React.useContext(PromptContext);
  if (!ctx) throw new Error("usePrompt must be used inside <PromptDialogProvider>");
  return ctx;
}
