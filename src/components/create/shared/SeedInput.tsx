import { useRef, useState, type FormEvent } from "react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Link as LinkIcon } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  busy?: boolean;
};

/** Seed input: paste · URL · upload · voice. Native pickers on mobile. */
export function SeedInput({ value, onChange, onSubmit, placeholder = "Say or paste what you want…", busy }: Props) {
  const transcribe = useServerFn(aiTranscribe);
  const [recording, setRecording] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        try {
          const res = await transcribe({ data: { audioBase64: b64, mimeType: "audio/webm" } });
          if (res.text) onChange(value ? `${value} ${res.text}` : res.text);
        } catch {
          /* ignore */
        }
      };
      mr.start();
      recorder.current = mr;
      setRecording(true);
    } catch {
      /* mic denied — user can type */
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      onChange(value ? `${value}\n\n${text}` : text);
    };
    reader.readAsText(f);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    onSubmit();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-elev hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileRef} type="file" accept=".txt,.md,.pdf,image/*" className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Paste URL");
              if (url) onChange(value ? `${value}\n${url}` : url);
            }}
            aria-label="Add URL"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-elev hover:text-foreground"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <HoldToSpeakButton onStart={start} onEnd={stop} active={recording} />
          <button
            type="submit"
            disabled={!value.trim() || busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {busy ? "Working…" : "Generate"}
          </button>
        </div>
      </div>
    </form>
  );
}
