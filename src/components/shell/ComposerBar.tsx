import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Settings2 } from "lucide-react";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { MicPermissionSheet } from "@/components/shell/MicPermissionSheet";
import { useHasScopedMic } from "@/lib/voice/voice-scope";

import { aiTranscribe } from "@/lib/ai/ai.functions";


const MIC_HELP_SHOWN_KEY = "eve:mic-help-shown";

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
    return "Mic is blocked for this site. Enable it in the browser permission popup or site controls, then press again.";
  }
  if (name === "NotFoundError") return "No microphone found.";
  if (name === "NotReadableError") return "Mic is already in use by another app.";
  return err instanceof Error ? err.message : "Mic error";
}

type ComposerBarProps = {
  onGenerate: (prompt: string) => void;
  busy?: boolean;
};

export function ComposerBar({ onGenerate, busy: externalBusy = false }: ComposerBarProps) {
  const hasScopedMic = useHasScopedMic();
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState | "unknown">("unknown");
  const [helpOpen, setHelpOpen] = useState(false);

  const transcribeFn = useServerFn(aiTranscribe);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  const wantsRecordingRef = useRef(false);

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    let permissionUpdate: (() => void) | null = null;
    let cancelled = false;

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permissionStatus = status;
          const update = () => {
            setMicPermission(status.state);
            if (status.state !== "denied") setMicErr(null);
          };
          permissionUpdate = update;
          status.addEventListener("change", update);
          update();
        })
        .catch(() => {
          /* Safari may not support microphone permission queries. */
        });
    }

    return () => {
      cancelled = true;
      if (permissionStatus && permissionUpdate) {
        permissionStatus.removeEventListener("change", permissionUpdate);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function emit(prompt: string) {
    const p = prompt.trim();
    if (p.length < 2) return;
    setValue("");
    onGenerate(p);
  }


  async function startRecording() {
    wantsRecordingRef.current = true;
    setRequestingMic(true);
    setMicErr(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicErr("Mic not supported");
      setRequestingMic(false);
      setListening(false);
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setMicErr("Mic recording is not supported in this browser.");
      setRequestingMic(false);
      setListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setMicPermission("granted");
      if (!wantsRecordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setMicErr("Mic is ready — hold the button again to speak.");
        setRequestingMic(false);
        setListening(false);
        return;
      }
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime ?? "audio/webm";
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
            emit(clean);
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
      setRequestingMic(false);
      setListening(true);
      if (!wantsRecordingRef.current) stopRecording();
    } catch (err) {
      const denied =
        err instanceof Error && (err.name === "NotAllowedError" || err.name === "SecurityError");
      if (denied) {
        setMicPermission("denied");
        try {
          const seen = sessionStorage.getItem(MIC_HELP_SHOWN_KEY);
          if (!seen) {
            sessionStorage.setItem(MIC_HELP_SHOWN_KEY, "1");
            setHelpOpen(true);
          }
        } catch {
          setHelpOpen(true);
        }
      }
      setMicErr(micErrorMessage(err));
      setRequestingMic(false);
      setListening(false);
    }
  }

  function stopRecording() {
    wantsRecordingRef.current = false;
    setRequestingMic(false);
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
    if (externalBusy) return;
    emit(value);
  }

  const busy = externalBusy || transcribing;
  const placeholder = externalBusy
    ? "Eve is thinking…"
    : transcribing
      ? "Transcribing…"
      : requestingMic
        ? "Requesting mic…"
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
          ) : hasScopedMic ? null : (
            <HoldToSpeakButton
              active={requestingMic || listening}
              disabled={busy}
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
        {(micErr || micPermission === "denied") && (
          <div className="flex items-center justify-between gap-2 px-2 text-[11px]">
            <p className="text-destructive">
              {micErr ?? "Microphone is blocked for this site."}
            </p>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex flex-shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-accent hover:bg-accent/20"
            >
              <Settings2 className="h-3 w-3" />
              Fix mic access
            </button>
          </div>
        )}
      </div>
      <MicPermissionSheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onRetry={() => void startRecording()}
      />
    </form>
  );
}
