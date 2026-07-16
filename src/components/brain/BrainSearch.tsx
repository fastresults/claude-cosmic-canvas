import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Mic, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { hapticStart, hapticEnd, hapticCancel, hapticTap } from "@/lib/platform/haptics";
import { NODE_COLOR, TYPE_LABEL } from "./three/palette";
import type { GraphNode } from "./three/useBrainGraph";

type Props = {
  nodes: GraphNode[];
  onPick: (node: GraphNode) => void;
};

type Ranked = { node: GraphNode; score: number };

function rank(nodes: GraphNode[], q: string): Ranked[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const out: Ranked[] = [];
  for (const n of nodes) {
    if (n.id === "you") continue;
    const label = n.label.toLowerCase();
    const type = (TYPE_LABEL[n.nodeType] ?? n.nodeType).toLowerCase();
    let score = 0;
    if (label === query) score = 100;
    else if (label.startsWith(query)) score = 80;
    else if (label.includes(query)) score = 60;
    else if (type.includes(query)) score = 30;
    if (score > 0) out.push({ node: n, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function BrainSearch({ nodes, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const transcribeFn = useServerFn(aiTranscribe);
  const level = useAudioLevel(recording ? stream : null);

  const results = useMemo(() => rank(nodes, q), [nodes, q]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
        setQ("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function startRec() {
    setStatus(null);
    cancelledRef.current = false;
    hapticStart();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      const rec = new MediaRecorder(s, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 800) {
          setStatus("Try holding a bit longer");
          return;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000)
          bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const b64 = btoa(bin);
        setStatus("Transcribing…");
        try {
          const { text } = await transcribeFn({
            data: { audioBase64: b64, mimeType: "audio/webm" },
          });
          const clean = text.trim().replace(/[.!?]+$/, "");
          setQ(clean);
          setStatus(null);
          inputRef.current?.focus();
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Transcription failed");
        }
      };
      rec.start();
      mediaRef.current = rec;
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((n) => n + 1), 1000);
      setRecording(true);
    } catch {
      setMicAvailable(false);
      setStatus("Mic access denied");
    }
  }

  function stopRec() {
    cancelledRef.current = false;
    hapticEnd();
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  function cancelRec() {
    cancelledRef.current = true;
    hapticCancel();
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search brain"
        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/50 text-white/70 backdrop-blur-md transition-colors hover:text-white"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="absolute right-3 top-3 z-20 w-[min(20rem,calc(100vw-1.5rem))]">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 pl-3 pr-1 py-1 backdrop-blur-md">
        <Search className="h-4 w-4 flex-shrink-0 text-white/50" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your brain"
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-white placeholder:text-white/40 outline-none"
        />
        {micAvailable && (
          <button
            type="button"
            aria-label={recording ? "Stop recording" : "Hold to speak"}
            aria-pressed={recording}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              if (recording) {
                stopRec();
              } else {
                hapticTap();
                void startRec();
              }
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onPointerCancel={() => cancelRec()}
            onContextMenu={(e) => e.preventDefault()}
            style={
              recording
                ? {
                    boxShadow: `0 0 0 2px oklch(0.82 0.14 82 / ${(0.35 + level * 0.5).toFixed(2)}), 0 0 ${Math.round(6 + level * 20)}px oklch(0.82 0.14 82 / 0.6)`,
                  }
                : undefined
            }
            className={`relative grid h-7 w-7 flex-shrink-0 place-items-center rounded-full touch-none select-none transition-all ${
              recording
                ? "bg-accent text-accent-foreground scale-110"
                : "text-white/60 hover:text-white"
            }`}
          >
            {recording && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full bg-accent/50 animate-ping"
              />
            )}
            {recording ? (
              <Square className="relative h-3 w-3 fill-current" />
            ) : (
              <Mic className="relative h-3.5 w-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Close search"
          onClick={() => {
            setOpen(false);
            setQ("");
            setStatus(null);
          }}
          className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-white/60 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {recording && (
        <div className="mt-2 flex items-center gap-2 rounded-full border border-accent/30 bg-black/70 px-3 py-1.5 backdrop-blur-md animate-fade-in">
          <span className="relative grid h-2.5 w-2.5 place-items-center">
            <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-70" />
            <span className="relative h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="tabular-nums text-[11px] text-white/70 w-8">
            {`${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`}
          </span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-75"
              style={{ width: `${Math.round(Math.max(0.04, level) * 100)}%` }}
            />
          </span>
          <button
            type="button"
            onClick={cancelRec}
            aria-label="Cancel recording"
            className="grid h-6 w-6 place-items-center rounded-full text-white/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}


      {(status || (q.trim() && results.length === 0) || results.length > 0) && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/70 backdrop-blur-md">
          {status && (
            <div className="px-3 py-2 text-xs text-white/60">{status}</div>
          )}
          {!status && q.trim() && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-white/50">
              Nothing yet — try a different word.
            </div>
          )}
          {results.length > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map(({ node }) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(node);
                      setOpen(false);
                      setQ("");
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{
                        background: NODE_COLOR[node.nodeType],
                        boxShadow: `0 0 8px ${NODE_COLOR[node.nodeType]}`,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {node.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      {TYPE_LABEL[node.nodeType] ?? node.nodeType}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
