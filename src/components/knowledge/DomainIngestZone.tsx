import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Link as LinkIcon,
  ClipboardType,
  Youtube,
  Sparkles,
  Loader2,
} from "lucide-react";
import { parseDocument } from "@/lib/knowledge/parsing.functions";
import { extractResume } from "@/lib/knowledge/extract.functions";
import { ingestEntry } from "@/lib/knowledge/knowledge.functions";
import { ingestYouTube } from "@/lib/knowledge/youtube.functions";
import { scrapeUrl } from "@/lib/knowledge/parsing.functions";
import { aiTranscribe } from "@/lib/ai/ai.functions";
import { fileToBase64 } from "./shared";
import { ResumeConfirmSheet } from "./ResumeConfirmSheet";
import { YouTubeSheet } from "./capture/YouTubeSheet";
import { usePrompt } from "@/components/prompt-dialog";
import { ResearchSheet } from "./capture/ResearchSheet";
import { PasteSheet } from "./capture/PasteSheet";
import type { StructuredProfile } from "@/lib/knowledge/extract.functions";

type Props = {
  domainId: string | null;
  domainName: string;
  profileId?: string | null;
};

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i;

export function DomainIngestZone({ domainId, domainName, profileId = null }: Props) {
  const qc = useQueryClient();
  const promptUrl = usePrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [smartValue, setSmartValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ytOpen, setYtOpen] = useState<{ open: boolean; url?: string }>({ open: false });
  const [researchOpen, setResearchOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pendingResume, setPendingResume] = useState<{
    structured: StructuredProfile;
    markdown: string;
    fileName: string;
  } | null>(null);

  const parseFn = useServerFn(parseDocument);
  const extractFn = useServerFn(extractResume);
  const ingestFn = useServerFn(ingestEntry);
  const transcribeFn = useServerFn(aiTranscribe);
  const scrapeFn = useServerFn(scrapeUrl);
  const ytFn = useServerFn(ingestYouTube);

  const done = () => {
    setStatus(null);
    qc.invalidateQueries({ queryKey: ["knowledge", "entries"] });
    qc.invalidateQueries({ queryKey: ["settings", "domain-counts"] });
  };

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      setError(null);
      const b64 = await fileToBase64(file);
      const mime = file.type || "application/octet-stream";
      if (mime.startsWith("audio/")) {
        setStatus(`Transcribing ${file.name}…`);
        const { text } = await transcribeFn({ data: { audioBase64: b64, mimeType: mime } });
        return ingestFn({
          data: {
            profile_id: profileId,
            domain_id: domainId,
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
        setStatus("Extracting résumé…");
        const structured = await extractFn({ data: { markdown: parsed.markdown } });
        setPendingResume({ structured, markdown: parsed.markdown, fileName: file.name });
        return null;
      }
      setStatus("Embedding…");
      return ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId,
          source_type: "upload",
          title: file.name,
          content: parsed.markdown,
          tags: [],
          kind: parsed.detectedKind === "bio" ? "bio" : "note",
          meta: { fileName: file.name, mimeType: mime },
        },
      });
    },
    onSuccess: done,
    onError: (e) => {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  const smartPaste = useMutation({
    mutationFn: async (raw: string) => {
      setError(null);
      const value = raw.trim();
      const yt = value.match(YT_RE);
      if (yt) {
        setStatus("Fetching transcript…");
        return ytFn({
          data: { url: value, domain_id: domainId, profile_id: profileId },
        });
      }
      if (/^https?:\/\//i.test(value)) {
        setStatus("Fetching page…");
        const scraped = await scrapeFn({ data: { url: value } });
        setStatus("Embedding…");
        return ingestFn({
          data: {
            profile_id: profileId,
            domain_id: domainId,
            source_type: "url",
            title: scraped.title ?? value,
            content: `${scraped.title ?? ""}\n\n${scraped.markdown}`.trim(),
            source_url: value,
            tags: [],
            kind: "url",
            meta: { description: scraped.description, image: scraped.image },
          },
        });
      }
      // Plain text note
      setStatus("Saving note…");
      return ingestFn({
        data: {
          profile_id: profileId,
          domain_id: domainId,
          source_type: "paste",
          title: null,
          content: value,
          tags: [],
          kind: "note",
          meta: {},
        },
      });
    },
    onSuccess: () => {
      setSmartValue("");
      done();
    },
    onError: (e) => {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  const busy = uploadFile.isPending || smartPaste.isPending;

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const files = Array.from(e.dataTransfer.files);
          files.forEach((f) => uploadFile.mutate(f));
        }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/10"
            : "border-border bg-surface-elev hover:border-accent/60"
        }`}
      >
        <Upload className={`h-6 w-6 ${dragging ? "text-accent" : "text-muted-foreground"}`} />
        <div className="text-sm font-medium text-foreground">
          Drop files, paste URLs, or tap to upload
        </div>
        <div className="text-xs text-muted-foreground">
          PDF · TXT · MD · Audio · YouTube · Any web page
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.txt,.md,.json,audio/*"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            files.forEach((f) => uploadFile.mutate(f));
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </div>

      {/* Smart paste bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (smartValue.trim()) smartPaste.mutate(smartValue);
        }}
        className="flex gap-2"
      >
        <input
          value={smartValue}
          onChange={(e) => setSmartValue(e.target.value)}
          placeholder="Paste a link, YouTube URL, or a quick note…"
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!smartValue.trim() || busy}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* One-tap tiles */}
      <div className="grid grid-cols-4 gap-2">
        <TileButton
          icon={<LinkIcon className="h-4 w-4" />}
          label="URL"
          onClick={async () => {
            const v = await promptUrl({
              title: "Add URL",
              label: "Paste a URL",
              placeholder: "https://…",
              required: true,
              inputType: "url",
              confirmLabel: "Add",
              validate: (val) => (/^https?:\/\/\S+/i.test(val) ? null : "Enter a valid URL"),
            });
            if (v) smartPaste.mutate(v);
          }}
        />
        <TileButton
          icon={<Youtube className="h-4 w-4" />}
          label="YouTube"
          onClick={() => setYtOpen({ open: true })}
        />
        <TileButton
          icon={<ClipboardType className="h-4 w-4" />}
          label="Note"
          onClick={() => setPasteOpen(true)}
        />
        <TileButton
          icon={<Sparkles className="h-4 w-4" />}
          label="Research"
          accent
          onClick={() => setResearchOpen(true)}
        />
      </div>

      {(status || error) && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elev px-3 py-2 text-xs">
          {status && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
          <span className={error ? "text-destructive" : "text-muted-foreground"}>
            {error ?? status}
          </span>
        </div>
      )}

      <YouTubeSheet
        open={ytOpen.open}
        onOpenChange={(v) => setYtOpen({ open: v })}
        profileId={profileId}
        domainId={domainId}
        initialUrl={ytOpen.url}
      />
      <ResearchSheet
        open={researchOpen}
        onOpenChange={setResearchOpen}
        profileId={profileId}
        domainId={domainId}
        domainName={domainName}
      />
      <PasteSheet
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        profileId={profileId}
        domainId={domainId}
      />
      {pendingResume && (
        <ResumeConfirmSheet
          open={!!pendingResume}
          onOpenChange={(v) => !v && setPendingResume(null)}
          structured={pendingResume.structured}
          markdown={pendingResume.markdown}
          sourceType="resume"
          title={pendingResume.fileName}
          sourceUrl={null}
          profileId={profileId}
          domainId={domainId}
          onSaved={() => setPendingResume(null)}
        />
      )}
    </div>
  );
}

function TileButton({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-border px-2 py-3 text-xs transition-colors hover:border-accent hover:bg-surface-elev ${
        accent ? "bg-accent/10 text-accent" : "bg-card text-foreground"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}
