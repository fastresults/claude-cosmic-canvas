import { useState } from "react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";

export function ComposerBar() {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-border frosted"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            listening ? "Listening…" : "Hold to speak, or type…"
          }
          className="flex-1 rounded-full border border-input bg-surface-elev px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent"
        />
        <HoldToSpeakButton
          onStart={() => setListening(true)}
          onEnd={() => setListening(false)}
        />
      </div>
    </div>
  );
}
