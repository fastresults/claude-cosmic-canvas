import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { aiTranscribe } from "@/lib/ai/ai.functions";

export type VoiceDictationStatus = "idle" | "recording" | "transcribing" | "error";

export function useVoiceDictation(onText: (text: string) => void) {
  const transcribeFn = useServerFn(aiTranscribe);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<VoiceDictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!supported) {
      setError("Voice input not supported on this device");
      setStatus("error");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const usedType = rec.mimeType || "audio/webm";
        cleanup();
        const blob = new Blob(chunksRef.current, { type: usedType });
        if (blob.size < 512) {
          setStatus("idle");
          return;
        }
        setStatus("transcribing");
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 0x8000)
            bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          const b64 = btoa(bin);
          const { text } = await transcribeFn({
            data: { audioBase64: b64, mimeType: usedType },
          });
          if (text?.trim()) onText(text.trim());
          setStatus("idle");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      };
      rec.start();
      mediaRef.current = rec;
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      setStatus("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      cleanup();
    }
  }, [supported, transcribeFn, onText, cleanup]);

  const stop = useCallback(() => {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "recording") stop();
    else if (status === "idle" || status === "error") start();
  }, [status, start, stop]);

  return { status, error, elapsed, supported, start, stop, toggle };
}
