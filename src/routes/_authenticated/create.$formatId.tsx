import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Save, Archive } from "lucide-react";
import { getFormat } from "@/config/createFormats";
import { SeedInput } from "@/components/create/shared/SeedInput";
import { StreamCanvas } from "@/components/create/shared/StreamCanvas";
import { DecisionDock } from "@/components/create/shared/DecisionDock";
import { ActiveWorkspacePill } from "@/components/workspaces/ActiveWorkspacePill";
import { useWorkspaceUrlContext } from "@/hooks/useWorkspaceUrlContext";
import { useWorkspaceContext, readWorkspaceContext } from "@/lib/workspaces/workspaceContextStore";
import {
  generateCreateDraft,
  getCreateDraft,
  archiveCreateDraft,
} from "@/lib/create/create.functions";

const search = z.object({
  draftId: z.string().uuid().optional(),
  seed: z.string().optional(),
  autoStart: z.coerce.boolean().optional(),
  wsId: z.string().uuid().optional(),
  wsItemId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/create/$formatId")({
  validateSearch: (raw) => search.parse(raw),
  beforeLoad: ({ params }) => {
    if (!getFormat(params.formatId)) throw notFound();
  },
  head: ({ params }) => {
    const f = getFormat(params.formatId);
    return {
      meta: [
        { title: `${f?.label ?? "Create"} — Eve` },
        { name: "description", content: f?.description ?? "Create with Eve." },
      ],
    };
  },
  component: FormatPage,
});

type Section = { heading: string | null; body: string };

function FormatPage() {
  const { formatId } = Route.useParams();
  const { draftId, seed: seedFromUrl, autoStart, wsId, wsItemId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const format = getFormat(formatId)!;

  // Sync workspace context from URL into the global store for this page.
  useWorkspaceUrlContext(wsId ?? null, wsItemId ?? null);
  const workspaceId = useWorkspaceContext((s) => s.workspaceId);

  const generateFn = useServerFn(generateCreateDraft);
  const getDraftFn = useServerFn(getCreateDraft);
  const archiveFn = useServerFn(archiveCreateDraft);

  const [seed, setSeed] = useState(seedFromUrl ?? "");
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate existing draft if resuming.
  useEffect(() => {
    if (!draftId) return;
    void getDraftFn({ data: { id: draftId } }).then((row) => {
      if (!row) return;
      setCurrentDraftId(row.id);
      setTitle(row.title ?? null);
      setSections((row.sections as unknown as Section[]) ?? []);
      setSeed("");
    });
  }, [draftId, getDraftFn]);

  async function runGenerate() {
    if (!seed.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // Read workspace context fresh (store + URL). Store is source of truth here.
      const ctx = readWorkspaceContext();
      const res = await generateFn({
        data: {
          formatId,
          seed: seed.trim(),
          draftId: currentDraftId ?? undefined,
          workspaceId: ctx.workspace_id ?? wsId ?? null,
          workspaceItemId: ctx.workspace_item_id ?? wsItemId ?? null,
        },
      });
      if ("fallback" in res && res.fallback) {
        setError(res.message);
      } else {
        setSections(res.sections);
        setTitle(res.title);
        if (res.draftId) setCurrentDraftId(res.draftId);
        qc.invalidateQueries({ queryKey: ["create-drafts"] });
        qc.invalidateQueries({ queryKey: ["workspace", ctx.workspace_id] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  // Voice Orb / Home CTA auto-start.
  useEffect(() => {
    if (!autoStart || !seedFromUrl) return;
    void runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onArchive() {
    if (!currentDraftId) return;
    await archiveFn({ data: { id: currentDraftId, archived: true } });
    qc.invalidateQueries({ queryKey: ["create-drafts"] });
    void navigate({ to: "/create" });
  }

  const hasDraft = sections.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Link to="/create" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All formats
        </Link>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{format.category}</span>
      </div>

      <header>
        <h1 className="font-display text-2xl text-foreground">{format.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{format.description}</p>
      </header>

      <SeedInput
        value={seed}
        onChange={setSeed}
        onSubmit={runGenerate}
        busy={busy}
        placeholder={
          format.mobileFlow === "voice-first"
            ? "Hold to speak, or type…"
            : `What should this ${format.label.toLowerCase()} be about?`
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {(hasDraft || busy) && (
        <div className="space-y-3">
          {title && <h2 className="font-display text-xl text-foreground">{title}</h2>}
          <StreamCanvas sections={sections} busy={busy} />
        </div>
      )}

      {hasDraft && (
        <DecisionDock>
          <button
            onClick={runGenerate}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["create-drafts"] })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Save className="h-3.5 w-3.5" /> Saved
          </button>
          {currentDraftId && (
            <button
              onClick={onArchive}
              aria-label="Archive"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </DecisionDock>
      )}
    </div>
  );
}
