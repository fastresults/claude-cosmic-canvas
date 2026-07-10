import { useRef, useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseDocument } from "@/lib/knowledge/parsing.functions";
import { extractResume } from "@/lib/knowledge/extract.functions";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { fileToBase64 } from "../shared";
import { ResumeConfirmSheet } from "../ResumeConfirmSheet";
import type { StructuredProfile } from "@/lib/knowledge/extract.functions";
import { Upload } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
  domainId?: string | null;
};

export function UploadSheet({ open, onOpenChange, profileId, domainId }: Props) {
  const qc = useQueryClient();
  const parseFn = useServerFn(parseDocument);
  const extractFn = useServerFn(extractResume);
  const ingestFn = useServerFn(ingestEntry);
  const transcribeFn = useServerFn(aiTranscribe);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingResume, setPendingResume] = useState<{
    structured: StructuredProfile;
    markdown: string;
    fileName: string | null;
  } | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setError(null);
      const base64 = await fileToBase64(file);
      const mime = file.type || "application/octet-stream";

      if (mime.startsWith("audio/")) {
        setStatus("Transcribing…");
        const { text } = await transcribeFn({
          data: { audioBase64: base64, mimeType: mime },
        });
        setStatus("Saving…");
        return ingestFn({
          data: {
            profile_id: profileId,
          domain_id: domainId ?? null,
            source_type: "audio",
            title: file.name,
            content: text,
            tags: [],
            kind: "note",
            meta: { fileName: file.name, mimeType: mime },
          },
        });
      }

      setStatus("Parsing…");
      const parsed = await parseFn({
        data: { fileBase64: base64, mimeType: mime, fileName: file.name },
      });

      if (parsed.detectedKind === "resume") {
        setStatus("Extracting résumé…");
        const structured = await extractFn({ data: { markdown: parsed.markdown } });
        setPendingResume({
          structured,
          markdown: parsed.markdown,
          fileName: file.name,
        });
        return null;
      }

      setStatus("Saving…");
      return ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId ?? null,
          source_type: "upload",
          title: file.name,
          content: parsed.markdown,
          tags: [],
          kind: parsed.detectedKind === "bio" ? "bio" : "note",
          meta: { fileName: file.name, mimeType: mime, detectedKind: parsed.detectedKind },
        },
      });
    },
    onSuccess: (res) => {
      setStatus(null);
      if (res) {
        qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
        onOpenChange(false);
      }
    },
    onError: (e) => {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  return (
    <>
      <EveSheet open={open} onOpenChange={onOpenChange} title="Upload a file">
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".pdf,.txt,.md,.json,audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-elev px-4 py-10 text-sm text-muted-foreground hover:bg-surface disabled:opacity-50"
          >
            <Upload className="h-8 w-8 text-accent" />
            <span className="font-medium text-foreground">
              {status ?? "Tap to choose a file"}
            </span>
            <span className="text-xs">PDF · TXT · MD · Audio</span>
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </EveSheet>

      {pendingResume && (
        <ResumeConfirmSheet
          open={!!pendingResume}
          onOpenChange={(v) => !v && setPendingResume(null)}
          structured={pendingResume.structured}
          markdown={pendingResume.markdown}
          sourceType="resume"
          title={pendingResume.fileName ?? "Résumé"}
          sourceUrl={null}
          profileId={profileId}
          onSaved={() => {
            setPendingResume(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
