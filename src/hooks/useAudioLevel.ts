import { useEffect, useRef, useState } from "react";

/**
 * Live microphone level (0..1 RMS) from an active MediaStream.
 * Pass `null` to stop and release the AudioContext.
 */
export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    let cancelled = false;
    const ctx = new AC();
    ctxRef.current = ctx;
    let source: MediaStreamAudioSourceNode;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch {
      return;
    }
    sourceRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Perceptual boost — quiet speech should still register.
      const boosted = Math.min(1, Math.pow(rms * 2.4, 0.7));
      setLevel(boosted);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      setLevel(0);
    };
  }, [stream]);

  return level;
}
