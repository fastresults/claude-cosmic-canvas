import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseDocument } from "@/lib/knowledge/parsing.functions";
import { extractResume } from "@/lib/knowledge/extract.functions";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { fileToBase64 } from "./shared";
import { ResumeConfirmSheet } from "./ResumeConfirmSheet";
import type { StructuredProfile } from "@/lib/knowledge/extract.functions";
import { Upload } from "lucide-react";

type Props = { profileId: string | null };

export function DesktopDropzone({ profileId }: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    structured: StructuredProfile;
    markdown: string;
    fileName: string;
  } | null>(null);

  const qc = useQueryClient();
  const parseFn = useServerFn(parseDocument);
  const extractFn = useServerFn(extractResume);
  const ingestFn = useServerFn(ingestEntry);
  const transcribeFn = useServerFn(aiTranscribe);

  useEffect(() => {
    if (isMobile) return;
    let dragCounter = 0;
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCounter++;
      setVisible(true);
    };
    const onLeave = () => {
      dragCounter--;
      if (dragCounter <= 0) setVisible(false);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
    };
  }, [isMobile]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const b64 = await fileToBase64(file);
      const mime = file.type || "application/octet-stream";
      if (mime.startsWith("audio/")) {
        setStatus(`Transcribing ${file.name}…`);
        const { text } = await transcribeFn({ data: { audioBase64: b64, mimeType: mime } });
        return ingestFn({
          data: {
            profile_id: profileId,
            source_type: "audio",
            title: file.name,
            content: text,
            tags: [],
            kind: "note",
            meta: { fileName: file.name, mimeType: mime },
          },
        });
      }
      setStatus(`Parsing ${file.name}…`);
      const parsed = await parseFn({
        data: { fileBase64: b64, mimeType: mime, fileName: file.name },
      });
      if (parsed.detectedKind === "resume") {
        setStatus(`Extracting résumé…`);
        const structured = await extractFn({ data: { markdown: parsed.markdown } });
        setPending({ structured, markdown: parsed.markdown, fileName: file.name });
        return null;
      }
      return ingestFn({
        data: {
          profile_id: profileId,
          source_type: "upload",
          title: file.name,
          content: parsed.markdown,
          tags: [],
          kind: parsed.detectedKind === "bio" ? "bio" : "note",
          meta: { fileName: file.name, detectedKind: parsed.detectedKind },
        },
      });
    },
    onSuccess: (res) => {
      setStatus(null);
      if (res) qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
    },
    onError: (e) => setStatus(e instanceof Error ? `Error: ${e.message}` : "Error"),
    onSettled: () => setVisible(false),
  });

  if (isMobile) return null;

  return (
    <>
      {visible && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            files.forEach((f) => upload.mutate(f));
          }}
        >
          <div className="pointer-events-none flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-accent bg-surface/50 px-16 py-12 text-center">
            <Upload className="h-16 w-16 text-accent" />
            <div className="text-xl font-semibold">Drop to add to knowledge</div>
            <div className="text-sm text-muted-foreground">PDF · TXT · MD · Audio</div>
            {status && <div className="text-xs text-accent">{status}</div>}
          </div>
        </div>
      )}
      {pending && (
        <ResumeConfirmSheet
          open={!!pending}
          onOpenChange={(v) => !v && setPending(null)}
          structured={pending.structured}
          markdown={pending.markdown}
          sourceType="resume"
          title={pending.fileName}
          sourceUrl={null}
          profileId={profileId}
          onSaved={() => setPending(null)}
        />
      )}
    </>
  );
}
