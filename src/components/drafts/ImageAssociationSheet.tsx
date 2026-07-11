/**
 * Per-draft image association: Generate (streamed) · Upload · Library.
 * Every attach path funnels through attachDraftImage → create_media row
 * scoped to draftId + role.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Upload as UploadIcon, Library, X, Loader2, RefreshCw, Check } from "lucide-react";
import { streamDraftImage } from "@/lib/drafts/streamImage";
import { useAttachDraftImage, useImageConcepts, useImageStyles } from "@/hooks/useDraftImages";
import { supabase } from "@/integrations/supabase/client";
import { ThumbPeek } from "@/components/primitives/ThumbPeek";


type Role = "cover" | "social" | "inline";
type Concept = { prompt: string; style: string; aspect: string; rationale: string };

export function ImageAssociationSheet({
  open,
  onOpenChange,
  draftId,
  role = "cover",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draftId: string;
  role?: Role;
}) {
  const [tab, setTab] = useState<"generate" | "upload" | "library">("generate");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => onOpenChange(false)}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Attach image · {role}</div>
            <h2 className="font-display text-xl text-foreground">Add an image to this draft</h2>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-muted-foreground hover:bg-surface">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="mb-4 flex gap-1 rounded-full border border-border bg-surface p-1 text-xs">
          <TabBtn active={tab === "generate"} onClick={() => setTab("generate")} icon={<Sparkles className="h-3.5 w-3.5" />}>
            Generate
          </TabBtn>
          <TabBtn active={tab === "upload"} onClick={() => setTab("upload")} icon={<UploadIcon className="h-3.5 w-3.5" />}>
            Upload
          </TabBtn>
          <TabBtn active={tab === "library"} onClick={() => setTab("library")} icon={<Library className="h-3.5 w-3.5" />}>
            Library
          </TabBtn>
        </div>
        {tab === "generate" && <GenerateTab draftId={draftId} role={role} onDone={() => onOpenChange(false)} />}
        {tab === "upload" && <UploadTab draftId={draftId} role={role} onDone={() => onOpenChange(false)} />}
        {tab === "library" && <LibraryTab draftId={draftId} role={role} onDone={() => onOpenChange(false)} />}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------- Generate ----------------------------------------------------

function GenerateTab({ draftId, role, onDone }: { draftId: string; role: Role; onDone: () => void }) {
  const concepts = useImageConcepts();
  const attach = useAttachDraftImage(draftId);
  const styles = useImageStyles(role);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Concept | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [groundingTimedOut, setGroundingTimedOut] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);
  const defaultAspect = role === "social" ? "1:1" : "16:9";

  useEffect(() => {
    const key = `${draftId}:${role}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    setGroundingTimedOut(false);
    concepts.mutate({ draftId, role });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, role]);

  useEffect(() => {
    if (!concepts.isPending) return;
    const id = window.setTimeout(() => setGroundingTimedOut(true), 8_000);
    return () => window.clearTimeout(id);
  }, [concepts.isPending, draftId, role]);

  // Default-select first style once loaded.
  useEffect(() => {
    if (!styleId && styles.data && styles.data.length > 0) {
      setStyleId(styles.data[0].styleId);
    }
  }, [styles.data, styleId]);

  const fallbackList = useMemo<Concept[]>(
    () => [
      {
        prompt: `Editorial ${role} image for this draft, clean composition, clear focal point, brand-safe`,
        style: "editorial",
        aspect: defaultAspect,
        rationale: "Fast, polished default.",
      },
      {
        prompt: "Documentary-style image capturing the central idea, natural light, human context",
        style: "photo",
        aspect: defaultAspect,
        rationale: "Grounded and relatable.",
      },
      {
        prompt: "Bold vector illustration representing the draft's main idea, simple shapes, high contrast",
        style: "illustration",
        aspect: defaultAspect,
        rationale: "Readable at small sizes.",
      },
    ],
    [defaultAspect, role],
  );
  const list = concepts.data?.concepts ?? (groundingTimedOut ? fallbackList : []);
  const activeStyle = useMemo(
    () => styles.data?.find((s) => s.styleId === styleId) ?? null,
    [styles.data, styleId],
  );

  async function run(prompt: string, aspect: string) {
    setStreaming(true);
    setErr(null);
    setPreview(null);
    setIsFinal(false);
    try {
      const composed = activeStyle?.promptPrefix
        ? `${activeStyle.promptPrefix} ${prompt}`
        : prompt;
      await streamDraftImage(
        composed,
        (dataUrl, final) => {
          setPreview(dataUrl);
          if (final) setIsFinal(true);
        },
        aspect,
        activeStyle?.negativePrompt || undefined,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setStreaming(false);
    }
  }

  async function confirm() {
    if (!preview || !selected) return;
    try {
      const url = await uploadDataUrl(preview);
      await attach.mutateAsync({
        role,
        url,
        prompt: selected.prompt,
        styleId: activeStyle?.styleId ?? selected.style,
        aspectRatio: selected.aspect,
        generatedBy: "gemini",
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Attach failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!preview && !streaming && (
        <>
          {/* Style templates strip */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Style template</div>
              {activeStyle && (
                <div className="text-[10px] text-muted-foreground">{activeStyle.name}</div>
              )}
            </div>
            {styles.isPending && (
              <div className="flex gap-2 overflow-x-auto">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 w-28 shrink-0 animate-pulse rounded-xl bg-surface" />
                ))}
              </div>
            )}
            {styles.isError && (
              <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <span>Couldn't load style templates.</span>
                <button
                  onClick={() => styles.refetch()}
                  className="rounded-full border border-destructive/40 px-3 py-1 text-[11px]"
                >
                  Retry
                </button>
              </div>
            )}
            {styles.data && styles.data.length === 0 && (
              <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
                No styles available for {role} yet.
              </div>
            )}
            {styles.data && styles.data.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {styles.data.map((s) => {
                  const active = s.styleId === styleId;
                  return (
                    <ThumbPeek
                      key={s.styleId}
                      src={s.previewUrl || ""}
                      alt={s.name}
                      label={s.name}
                      selected={active}
                      confirmLabel="Use this style"
                      onConfirm={() => setStyleId(s.styleId)}
                      className="h-20 w-28 shrink-0 overflow-hidden rounded-xl"
                    >
                      <div
                        className="relative flex h-full w-full flex-col items-start justify-end p-2"
                        style={
                          s.previewUrl
                            ? {
                                backgroundImage: `url(${s.previewUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : { background: "hsl(var(--surface))" }
                        }
                      >
                        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          {s.name}
                        </span>
                      </div>
                    </ThumbPeek>
                  );
                })}
              </div>
            )}
          </div>

          {concepts.isPending && !groundingTimedOut && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Grounding concepts from your draft…
            </div>
          )}
          {concepts.isPending && groundingTimedOut && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              Using quick-start concepts while draft grounding finishes.
            </div>
          )}
          {concepts.isError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <span>Couldn't ground concepts. You can still generate from your own prompt.</span>
              <button
                onClick={() => concepts.mutate({ draftId, role })}
                className="shrink-0 rounded-full border border-destructive/40 px-3 py-1 text-[11px]"
              >
                Retry
              </button>
            </div>
          )}
          {list.length > 0 && (
            <div className="grid gap-2">
              {list.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelected(c);
                    void run(c.prompt, c.aspect);
                  }}
                  className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3 text-left hover:border-accent/60"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span>{c.style}</span>
                    <span>·</span>
                    <span>{c.aspect}</span>
                  </div>
                  <div className="text-sm text-foreground">{c.prompt}</div>
                  {c.rationale && <div className="text-xs text-muted-foreground">{c.rationale}</div>}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Or describe your own concept…"
              className="flex-1 rounded-full border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-accent/60"
            />
            <button
              onClick={() => {
                if (!customPrompt.trim()) return;
                const c = { prompt: customPrompt.trim(), style: "custom", aspect: defaultAspect, rationale: "" };
                setSelected(c);
                void run(c.prompt, c.aspect);
              }}
              className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground"
            >
              Generate
            </button>
          </div>
        </>
      )}



      {(preview || streaming) && (
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-surface">
            {preview ? (
              <img
                src={preview}
                alt="preview"
                className={`h-full w-full object-cover transition-[filter] duration-300 ${
                  isFinal ? "blur-0" : "blur-2xl"
                }`}
              />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {streaming && !isFinal && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                <Loader2 className="h-3 w-3 animate-spin" /> Rendering…
              </div>
            )}
          </div>
          {selected && (
            <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
              <span className="text-foreground">Prompt:</span> {selected.prompt}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              disabled={streaming || !selected || attach.isPending}
              onClick={() => selected && run(selected.prompt, selected.aspect)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs text-foreground disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reroll
            </button>
            <button
              disabled={streaming || attach.isPending}
              onClick={() => {
                setPreview(null);
                setSelected(null);
                setIsFinal(false);
              }}
              className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground disabled:opacity-50"
            >
              Back
            </button>
            <button
              disabled={!isFinal || attach.isPending}
              onClick={confirm}
              className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground disabled:opacity-50"
            >
              {attach.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Attach to draft
            </button>
          </div>
        </div>
      )}
      {err && <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{err}</div>}
    </div>
  );
}

// ---------- Upload -------------------------------------------------------

function UploadTab({ draftId, role, onDone }: { draftId: string; role: Role; onDone: () => void }) {
  const attach = useAttachDraftImage(draftId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(f: File) {
    setBusy(true);
    setErr(null);
    try {
      const url = await uploadFile(f);
      await attach.mutateAsync({ role, url, generatedBy: "upload" });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground hover:border-accent/60"
    >
      <UploadIcon className="h-6 w-6" />
      <div>{busy ? "Uploading…" : "Tap to choose a photo, or drop a file here"}</div>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      {err && <div className="text-xs text-destructive">{err}</div>}
    </label>
  );
}

// ---------- Library ------------------------------------------------------

function LibraryTab({ draftId, role, onDone }: { draftId: string; role: Role; onDone: () => void }) {
  const attach = useAttachDraftImage(draftId);
  const [items, setItems] = useState<Array<{ id: string; url: string; prompt: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("create_media")
        .select("id, url, prompt")
        .eq("kind", "image")
        .order("created_at", { ascending: false })
        .limit(60);
      setItems((data ?? []) as Array<{ id: string; url: string; prompt: string | null }>);
      setLoading(false);
    })();
  }, []);
  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading library…</div>;
  if (!items.length)
    return <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">No images yet. Generate or upload one.</div>;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <ThumbPeek
          key={it.id}
          src={it.url}
          alt={it.prompt ?? ""}
          label={it.prompt ?? undefined}
          confirmLabel="Attach to draft"
          onConfirm={async () => {
            await attach.mutateAsync({ role, url: it.url, prompt: it.prompt ?? undefined, generatedBy: "library" });
            onDone();
          }}
          className="group aspect-square overflow-hidden rounded-xl bg-surface"
        >
          <img src={it.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        </ThumbPeek>
      ))}
    </div>
  );
}

// ---------- Storage helpers ---------------------------------------------

async function uploadDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], `gen-${Date.now()}.png`, { type: "image/png" });
  return uploadFile(file);
}

async function uploadFile(file: File): Promise<string> {
  const { data: session } = await supabase.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error("Not signed in");
  const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("draft-media").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  // Private bucket → long-lived signed URL (1 year).
  const { data: signed, error: sErr } = await supabase.storage
    .from("draft-media")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (sErr || !signed) throw sErr ?? new Error("Failed to sign URL");
  return signed.signedUrl;
}
