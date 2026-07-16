import { useEffect, useRef, useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { HoldToSpeakButton } from "@/components/primitives/HoldToSpeakButton";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";
import { useVoiceScopeOwner } from "@/lib/voice/voice-scope";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
  domainId?: string | null;
};

export function SpeakSheet({ open, onOpenChange, profileId, domainId }: Props) {
  useVoiceScopeOwner("speak-sheet", open);
  const qc = useQueryClient();
  const transcribeFn = useServerFn(aiTranscribe);
  const ingestFn = useServerFn(ingestEntry);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTranscript("");
      setError(null);
      setStatus(null);
    }
  }, [open]);

  const startRec = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
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
          setTranscript((prev) => (prev ? `${prev}\n\n${text}` : text));
          setStatus(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus(null);
        }
      };
      rec.start();
      mediaRef.current = rec;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopRec = () => {
    mediaRef.current?.stop();
    mediaRef.current = null;
  };

  const save = useMutation({
    mutationFn: () =>
      ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId ?? null,
          source_type: "voice_memo",
          content: transcript.trim(),
          tags: [],
          kind: "note",
          meta: {},
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
      onOpenChange(false);
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  return (
    <EveSheet open={open} onOpenChange={onOpenChange} title="Voice memo">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-4">
          <HoldToSpeakButton onStart={startRec} onEnd={stopRec} />
          <p className="text-xs text-muted-foreground">
            {status ?? "Hold the mic to record"}
          </p>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your transcript will appear here…"
          rows={6}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!transcript.trim() || save.isPending}
            onClick={() => save.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </EveSheet>
  );
}
