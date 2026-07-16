import * as React from "react";
import { Mic, Square, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Set to true to enable the built-in voice dictation button. Default: false — opt-in only, so surrounding forms with their own mic don't get a ghost second one. */
  voiceInput?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, voiceInput = false, disabled, readOnly, onChange, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [forwardedRef],
    );

    const appendText = React.useCallback(
      (text: string) => {
        const node = innerRef.current;
        if (!node) return;
        const current = node.value ?? "";
        const sep = current && !/\s$/.test(current) ? " " : "";
        const next = `${current}${sep}${text}`;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(node, next);
        node.dispatchEvent(new Event("input", { bubbles: true }));
      },
      [],
    );

    const voice = useVoiceDictation(appendText);
    const showMic = voiceInput && !disabled && !readOnly && voice.supported;

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showMic && "pr-12 pb-9",
            className,
          )}
          ref={setRefs}
          disabled={disabled}
          readOnly={readOnly}
          onChange={onChange}
          {...props}
        />
        {showMic && (
          <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-end justify-between gap-2">
            <span
              className={cn(
                "text-[10px] leading-none text-muted-foreground transition-opacity",
                voice.status === "idle" ? "opacity-0" : "opacity-100",
              )}
              aria-live="polite"
            >
              {voice.status === "recording" && `● Recording ${voice.elapsed}s`}
              {voice.status === "transcribing" && "Transcribing…"}
              {voice.status === "error" && (voice.error ?? "Voice error")}
            </span>
            <button
              type="button"
              onClick={voice.toggle}
              aria-label={voice.status === "recording" ? "Stop recording" : "Start voice input"}
              className={cn(
                "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground",
                voice.status === "recording" && "border-destructive/60 bg-destructive/10 text-destructive animate-pulse",
                voice.status === "transcribing" && "opacity-70",
              )}
              disabled={voice.status === "transcribing"}
            >
              {voice.status === "recording" ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : voice.status === "transcribing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
