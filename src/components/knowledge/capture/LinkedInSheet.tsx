import { useRef, useState } from "react";
import { EveSheet } from "@/components/primitives/EveSheet";
import { Pill } from "@/components/primitives/Pill";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { scrapeLinkedIn } from "@/lib/knowledge/parsing.functions";
import { parseDocument } from "@/lib/knowledge/parsing.functions";
import { extractResume } from "@/lib/knowledge/extract.functions";
import { fileToBase64 } from "../shared";
import { ResumeConfirmSheet } from "../ResumeConfirmSheet";
import type { StructuredProfile } from "@/lib/knowledge/extract.functions";
import { Linkedin, FileText, Upload } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string | null;
};

export function LinkedInSheet({ open, onOpenChange, profileId }: Props) {
  const [mode, setMode] = useState<"url" | "resume">("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{
    structured: StructuredProfile;
    markdown: string;
    sourceType: "linkedin" | "resume";
    title: string;
    sourceUrl: string | null;
  } | null>(null);

  const scrapeLI = useServerFn(scrapeLinkedIn);
  const parseFn = useServerFn(parseDocument);
  const extractFn = useServerFn(extractResume);

  const runUrl = useMutation({
    mutationFn: async () => {
      setError(null);
      setStatus("Scraping LinkedIn…");
      const structured = await scrapeLI({ data: { url: url.trim() } });
      setPending({
        structured,
        markdown: JSON.stringify(structured, null, 2),
        sourceType: "linkedin",
        title: structured.full_name || url,
        sourceUrl: url.trim(),
      });
      setStatus(null);
    },
    onError: (e) => {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  const runFile = useMutation({
    mutationFn: async (file: File) => {
      setError(null);
      setStatus("Parsing résumé…");
      const b64 = await fileToBase64(file);
      const parsed = await parseFn({
        data: { fileBase64: b64, mimeType: file.type || "application/pdf", fileName: file.name },
      });
      setStatus("Extracting fields…");
      const structured = await extractFn({ data: { markdown: parsed.markdown } });
      setPending({
        structured,
        markdown: parsed.markdown,
        sourceType: "resume",
        title: file.name,
        sourceUrl: null,
      });
      setStatus(null);
    },
    onError: (e) => {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    },
  });

  return (
    <>
      <EveSheet open={open} onOpenChange={onOpenChange} title="LinkedIn / Résumé">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Pill size="sm" variant={mode === "url" ? "solid" : "outline"} onClick={() => setMode("url")}>
              <Linkedin className="h-3.5 w-3.5" /> Paste URL
            </Pill>
            <Pill
              size="sm"
              variant={mode === "resume" ? "solid" : "outline"}
              onClick={() => setMode("resume")}
            >
              <FileText className="h-3.5 w-3.5" /> Upload résumé
            </Pill>
          </div>

          {mode === "url" ? (
            <div className="space-y-3">
              <input
                autoFocus
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/…"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!url.trim() || runUrl.isPending}
                  onClick={() => runUrl.mutate()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                  {runUrl.isPending ? (status ?? "Scraping…") : "Fetch profile"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                hidden
                accept=".pdf,.txt,.md"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runFile.mutate(f);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={runFile.isPending}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface-elev px-4 py-10 text-sm text-muted-foreground hover:bg-surface disabled:opacity-50"
              >
                <Upload className="h-8 w-8 text-accent" />
                <span className="font-medium text-foreground">
                  {runFile.isPending ? (status ?? "Working…") : "Tap to choose a résumé"}
                </span>
                <span className="text-xs">PDF, TXT, or Markdown</span>
              </button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </EveSheet>

      {pending && (
        <ResumeConfirmSheet
          open={!!pending}
          onOpenChange={(v) => !v && setPending(null)}
          structured={pending.structured}
          markdown={pending.markdown}
          sourceType={pending.sourceType}
          title={pending.title}
          sourceUrl={pending.sourceUrl}
          profileId={profileId}
          onSaved={() => {
            setPending(null);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
