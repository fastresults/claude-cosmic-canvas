import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { contentDraft } from "@/lib/content/content.functions";
import { aiTranscribe } from "@/lib/ai/ai.functions";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = String(r.result ?? "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

function micErrorMessage(err: unknown) {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Mic blocked — allow microphone access in your browser site settings, then try again.";
  }
  if (name === "NotFoundError") return "No microphone found.";
  if (name === "NotReadableError") return "Mic is already in use by another app.";
  return err instanceof Error ? err.message : "Mic error";
}

export function ComposerBar() {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);

  const draftFn = useServerFn(contentDraft);
  const transcribeFn = useServerFn(aiTranscribe);
  const qc = useQueryClient();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const wantsRecordingRef = useRef(false);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permissionStatus = status;
          const update = () => {
            if (status.state === "denied") {
              setMicErr("Mic blocked — allow microphone access in your browser site settings, then try again.");
            } else {
              setMicErr((current) => (current?.startsWith("Mic blocked") ? null : current));
            }
          };
          status.addEventListener("change", update);
          update();
        })
        .catch(() => {
          /* Safari may not support microphone permission queries. */
        });
    }

    return () => {
      cancelled = true;
      permissionStatus?.onchange?.(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (prompt: string) => draftFn({ data: { prompt, format: "post" } }),
    onSuccess: () => {
      setValue("");
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  async function startRecording() {
    wantsRecordingRef.current = true;
    setMicErr(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicErr("Mic not supported");
      setListening(false);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMicErr("Mic recording is not supported in this browser.");
      setListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!wantsRecordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        return;
      }
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime ?? stream.getAudioTracks()[0]?.getSettings?.().deviceId ? "audio/webm" : "audio/webm";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        chunksRef.current = [];
        if (blob.size < 800) return; // ignore accidental taps
        try {
          setTranscribing(true);
          const b64 = await blobToBase64(blob);
          const { text } = await transcribeFn({
            data: { audioBase64: b64, mimeType: mimeRef.current },
          });
          const clean = text?.trim();
          if (clean && clean.length > 1) {
            setValue(clean);
            mutation.mutate(clean);
          }
        } catch (err) {
          setMicErr(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      mimeRef.current = rec.mimeType || mimeRef.current;
      recorderRef.current = rec;
      setListening(true);
      if (!wantsRecordingRef.current) stopRecording();
    } catch (err) {
      setMicErr(micErrorMessage(err));
      setListening(false);
    }
  }

  function stopRecording() {
    wantsRecordingRef.current = false;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const p = value.trim();
    if (p.length < 2 || mutation.isPending) return;
    mutation.mutate(p);
  }

  const busy = mutation.isPending || transcribing;
  const placeholder = mutation.isPending
    ? "Eve is thinking…"
    : transcribing
      ? "Transcribing…"
      : listening
        ? "Listening…"
        : "Hold to speak, or type…";

  return (
    <form
      onSubmit={submit}
      className="fixed inset-x-0 z-30 border-t border-border frosted"
      style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            placeholder={placeholder}
            className="flex-1 rounded-full border border-input bg-surface-elev px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent disabled:opacity-60"
          />
          {value.trim().length > 1 ? (
            <button
              type="submit"
              disabled={busy}
              aria-label="Send"
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent text-accent-foreground amber-glow disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          ) : (
            <HoldToSpeakButton
              onStart={() => {
                void startRecording();
              }}
              onEnd={() => {
                setListening(false);
                stopRecording();
              }}
            />
          )}
        </div>
        {micErr && (
          <p className="px-2 text-[11px] text-destructive">{micErr}</p>
        )}
      </div>
    </form>
  );
}
