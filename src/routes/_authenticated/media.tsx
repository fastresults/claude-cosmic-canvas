// Media Hub — per-user digital asset manager.
// Independent of drafts and archive: users store any binary asset here
// (images, documents, audio, video) and reuse them anywhere.
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Music,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { EveSheet } from "@/components/primitives/EveSheet";
import {
  deleteMediaAsset,
  listMediaAssets,
  signMediaUrl,
  updateMediaAsset,
} from "@/lib/media/media.functions";
import { uploadMediaFile } from "@/lib/media/upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/media")({
  component: MediaHubPage,
});

type Kind = "image" | "document" | "audio" | "video" | "other";
type Asset = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  kind: Kind;
  title: string;
  description: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
};

const KIND_FILTERS: { label: string; value: Kind | "all"; Icon: typeof ImageIcon }[] = [
  { label: "All", value: "all", Icon: FileText },
  { label: "Images", value: "image", Icon: ImageIcon },
  { label: "Docs", value: "document", Icon: FileText },
  { label: "Audio", value: "audio", Icon: Music },
  { label: "Video", value: "video", Icon: Film },
];

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon =
    kind === "image" ? ImageIcon : kind === "audio" ? Music : kind === "video" ? Film : FileText;
  return <Icon className={className} />;
}

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function MediaHubPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMediaAssets);
  const deleteFn = useServerFn(deleteMediaAsset);
  const updateFn = useServerFn(updateMediaAsset);
  const signFn = useServerFn(signMediaUrl);

  const [kind, setKind] = useState<Kind | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: "up" | "done" | "err" }[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  const query = useQuery({
    queryKey: ["media", "list", kind, q],
    queryFn: () =>
      listFn({
        data: { limit: 120, kind: kind === "all" ? undefined : kind, q: q || undefined },
      }) as Promise<Asset[]>,
    staleTime: 10_000,
  });
  const assets = query.data ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["media", "list"] });
    },
  });

  const updateMut = useMutation({
    mutationFn: (input: { id: string; title?: string; description?: string | null; tags?: string[] }) =>
      updateFn({ data: input }),
    onSuccess: (row) => {
      setSelected(row as Asset);
      qc.invalidateQueries({ queryKey: ["media", "list"] });
    },
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading((s) => [...s, ...arr.map((f) => ({ name: f.name, progress: "up" as const }))]);
      for (const f of arr) {
        try {
          await uploadMediaFile(f);
          setUploading((s) =>
            s.map((u) => (u.name === f.name && u.progress === "up" ? { ...u, progress: "done" } : u)),
          );
        } catch (e) {
          console.error("media upload failed", f.name, e);
          setUploading((s) =>
            s.map((u) => (u.name === f.name && u.progress === "up" ? { ...u, progress: "err" } : u)),
          );
        }
      }
      qc.invalidateQueries({ queryKey: ["media", "list"] });
      // Clear "done" rows after a short delay.
      setTimeout(() => setUploading((s) => s.filter((u) => u.progress === "up")), 2000);
    },
    [qc],
  );

  const stats = useMemo(() => {
    const total = assets.reduce((n, a) => n + (a.size_bytes || 0), 0);
    return { count: assets.length, bytes: total };
  }, [assets]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/settings"
          className="rounded-md border border-border bg-card p-2 text-muted-foreground hover:bg-surface-elev"
          aria-label="Back to settings"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-foreground">Media Hub</h1>
          <p className="text-xs text-muted-foreground">
            {stats.count} {stats.count === 1 ? "item" : "items"} · {formatBytes(stats.bytes)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 font-display text-xs text-accent hover:bg-accent/20"
        >
          <Upload className="h-4 w-4" /> Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {KIND_FILTERS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 font-display text-[11px] tracking-wide transition-colors",
              kind === k.value
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-card text-muted-foreground hover:bg-surface-elev",
            )}
          >
            <k.Icon className="h-3 w-3" /> {k.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-56 rounded-md border border-border bg-card pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Dropzone / grid */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounter.current += 1;
          setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCounter.current = 0;
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative min-h-[320px] rounded-lg border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border bg-card/40",
        )}
      >
        {query.isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="font-display text-sm text-foreground">Drop files here to upload</p>
            <p className="text-xs text-muted-foreground">
              Images, documents, audio, and video — everything except drafts and archive lives here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {assets.map((a) => (
              <MediaTile
                key={a.id}
                asset={a}
                onOpen={() => setSelected(a)}
                signFn={(id) => signFn({ data: { id, expiresIn: 300 } }) as Promise<{ url: string }>}
              />
            ))}
          </div>
        )}

        {uploading.length > 0 && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-1">
            {uploading.map((u, i) => (
              <div
                key={`${u.name}-${i}`}
                className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs shadow-sm"
              >
                {u.progress === "up" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                {u.progress === "done" && (
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                )}
                {u.progress === "err" && <X className="h-3.5 w-3.5 text-destructive" />}
                <span className="truncate">{u.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <MediaDetailSheet
        asset={selected}
        onClose={() => setSelected(null)}
        onDelete={(id) => deleteMut.mutate(id)}
        onUpdate={(input) => updateMut.mutate(input)}
        signFn={(id) => signFn({ data: { id, expiresIn: 300 } }) as Promise<{ url: string }>}
      />
    </div>
  );
}

function MediaTile({
  asset,
  onOpen,
  signFn,
}: {
  asset: Asset;
  onOpen: () => void;
  signFn: (id: string) => Promise<{ url: string }>;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const needsThumb = asset.kind === "image";
  const requested = useRef(false);
  if (needsThumb && !thumb && !requested.current) {
    requested.current = true;
    signFn(asset.id)
      .then((r) => setThumb(r.url))
      .catch(() => {});
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-card text-left hover:border-accent/40"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-elev">
        {needsThumb && thumb ? (
          <img
            src={thumb}
            alt={asset.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <KindIcon kind={asset.kind} className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="min-w-0 px-2 py-1.5">
        <div className="truncate text-[11px] font-medium text-foreground">{asset.title}</div>
        <div className="truncate text-[10px] text-muted-foreground">
          {asset.kind} · {formatBytes(asset.size_bytes)}
        </div>
      </div>
    </button>
  );
}

function MediaDetailSheet({
  asset,
  onClose,
  onDelete,
  onUpdate,
  signFn,
}: {
  asset: Asset | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (input: { id: string; title?: string; description?: string | null; tags?: string[] }) => void;
  signFn: (id: string) => Promise<{ url: string }>;
}) {
  const router = useRouter();
  void router;
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const requested = useRef<string | null>(null);

  if (asset && requested.current !== asset.id) {
    requested.current = asset.id;
    setTitle(asset.title);
    setDescription(asset.description ?? "");
    setTags(asset.tags ?? []);
    setPreview(null);
    signFn(asset.id)
      .then((r) => setPreview(r.url))
      .catch(() => {});
  }

  const dirty =
    !!asset &&
    (title.trim() !== asset.title ||
      (description.trim() || null) !== (asset.description ?? null) ||
      JSON.stringify(tags) !== JSON.stringify(asset.tags ?? []));

  return (
    <EveSheet open={!!asset} onOpenChange={(v) => !v && onClose()} title={asset?.title}>
      {asset && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-border bg-surface-elev">
            {preview ? (
              asset.kind === "image" ? (
                <img src={preview} alt={title} className="max-h-[45dvh] w-full object-contain" />
              ) : asset.kind === "video" ? (
                <video src={preview} controls className="max-h-[45dvh] w-full" />
              ) : asset.kind === "audio" ? (
                <audio src={preview} controls className="w-full" />
              ) : asset.mime_type === "application/pdf" ? (
                <iframe src={preview} className="h-[45dvh] w-full" title={title} />
              ) : (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  <KindIcon kind={asset.kind} className="h-12 w-12" />
                </div>
              )
            ) : (
              <div className="flex h-48 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <Meta label="Type">{asset.mime_type}</Meta>
            <Meta label="Size">{formatBytes(asset.size_bytes)}</Meta>
            {asset.width && asset.height && (
              <Meta label="Dimensions">
                {asset.width} × {asset.height}
              </Meta>
            )}
            {asset.duration_seconds != null && (
              <Meta label="Duration">{Math.round(asset.duration_seconds)}s</Meta>
            )}
            <Meta label="Uploaded">{new Date(asset.created_at).toLocaleDateString()}</Meta>
            <Meta label="Filename">{asset.filename}</Meta>
          </div>

          <div className="space-y-2">
            <label className="block font-display text-xs text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-display text-xs text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-display text-xs text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface-elev px-2 py-0.5 text-[11px] text-foreground"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags((s) => s.filter((x) => x !== t))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagDraft.trim()) {
                    e.preventDefault();
                    const v = tagDraft.trim().slice(0, 40);
                    if (!tags.includes(v)) setTags((s) => [...s, v]);
                    setTagDraft("");
                  }
                }}
                placeholder="Add tag…"
                className="min-w-[100px] flex-1 rounded-pill border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={() =>
                onUpdate({
                  id: asset.id,
                  title: title.trim() || asset.filename,
                  description: description.trim() ? description.trim() : null,
                  tags,
                })
              }
              className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/15 px-3 py-2 font-display text-xs text-accent disabled:opacity-40"
            >
              Save
            </button>
            {preview && (
              <a
                href={preview}
                download={asset.filename}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-surface-elev"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${asset.title}"? This can't be undone.`)) onDelete(asset.id);
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </EveSheet>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-display text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-foreground">{children}</div>
    </div>
  );
}
