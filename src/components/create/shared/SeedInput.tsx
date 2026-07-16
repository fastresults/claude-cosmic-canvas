import { useRef, useState, type FormEvent } from "react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { RecordingIndicator } from "@/components/primitives/RecordingIndicator";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Link as LinkIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  busy?: boolean;
};

type RecStatus = "idle" | "recording" | "transcribing" | "error";

/** Seed input: paste · URL · upload · voice. Native pickers on mobile. */
export function SeedInput({ value, onChange, onSubmit, placeholder = "Say or paste what you want…", busy }: Props) {
  const transcribe = useServerFn(aiTranscribe);
  const [status, setStatus] = useState<RecStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const level = useAudioLevel(status === "recording" ? stream : null);

  function cleanup() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    recorder.current = null;
  }

  async function start() {
    setError(null);
    cancelledRef.current = false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      const mr = new MediaRecorder(s);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      mr.onstop = async () => {
        const wasCancelled = cancelledRef.current;
        cleanup();
        if (wasCancelled) {
          setStatus("idle");
          return;
        }
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size < 800) {
          setStatus("idle");
          return;
        }
        setStatus("transcribing");
        try {
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000)
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          const b64 = btoa(bin);
          const res = await transcribe({ data: { audioBase64: b64, mimeType: "audio/webm" } });
          if (res.text) onChange(value ? `${value} ${res.text}` : res.text);
          setStatus("idle");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed");
          setStatus("error");
        }
      };
      mr.start();
      recorder.current = mr;
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      setStatus("recording");
    } catch {
      setError("Microphone access denied");
      setStatus("error");
    }
  }

  function stop() {
    cancelledRef.current = false;
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
  }

  function cancel() {
    cancelledRef.current = true;
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
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

  const showIndicator = status === "recording" || status === "transcribing" || status === "error";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="resize-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
      />
      {showIndicator && (
        <div className="mt-2 flex justify-start">
          <RecordingIndicator
            status={status === "idle" ? "recording" : status}
            elapsed={elapsed}
            level={level}
            errorMessage={error}
            onCancel={cancel}
            onRetry={() => {
              setError(null);
              setStatus("idle");
              void start();
            }}
          />
        </div>
      )}
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
          <HoldToSpeakButton
            onStart={start}
            onEnd={stop}
            onCancel={cancel}
            active={status === "recording"}
            level={level}
          />
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
