import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Save, Archive, Sparkles, Loader2 } from "lucide-react";
import { getFormat, FORMAT_ALIAS_CHANNEL } from "@/config/createFormats";
import { SeedInput } from "@/components/create/shared/SeedInput";
import { StreamCanvas } from "@/components/create/shared/StreamCanvas";
import { DecisionDock } from "@/components/create/shared/DecisionDock";
import { DraftTitleHeader } from "@/components/create/DraftTitleHeader";
import { ChannelPicker } from "@/components/create/shared/ChannelPicker";
import { ActiveWorkspacePill } from "@/components/workspaces/ActiveWorkspacePill";
import { useWorkspaceUrlContext } from "@/hooks/useWorkspaceUrlContext";
import { RequireDefaultsGate } from "@/components/settings/RequireDefaultsGate";
import { useWorkspaceContext, readWorkspaceContext } from "@/lib/workspaces/workspaceContextStore";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_CHANNELS, isSocialChannel } from "@/lib/create/channel-rules";
import type { Channel } from "@/lib/workspaces/strategy";
import {
  generateCreateDraft,
  getCreateDraft,
  archiveCreateDraft,
  suggestDraftTitle,
  saveCreateDraft,
} from "@/lib/create/create.functions";
import { renameDraft } from "@/lib/drafts/drafts.functions";



const search = z.object({
  draftId: z.string().uuid().optional(),
  seed: z.string().optional(),
  autoStart: z.coerce.boolean().optional(),
  wsId: z.string().uuid().optional(),
  wsItemId: z.string().uuid().optional(),
  channel: z.string().optional(),
  channels: z.string().optional(), // comma-separated
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
  const { draftId, seed: seedFromUrl, autoStart, wsId, wsItemId, channel: channelFromUrl, channels: channelsFromUrl } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const format = getFormat(formatId)!;

  // Sync workspace context from URL into the global store for this page.
  useWorkspaceUrlContext(wsId ?? null, wsItemId ?? null);
  const workspaceId = useWorkspaceContext((s) => s.workspaceId);

  const generateFn = useServerFn(generateCreateDraft);
  const getDraftFn = useServerFn(getCreateDraft);
  const archiveFn = useServerFn(archiveCreateDraft);
  const renameFn = useServerFn(renameDraft);
  const suggestFn = useServerFn(suggestDraftTitle);


  const [seed, setSeed] = useState(seedFromUrl ?? "");
  const [sections, setSections] = useState<Section[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Title-naming gate: when generation returns pendingTitle, we hold the sections
  // in state and prompt for a name before persisting.
  const [pendingTitleInput, setPendingTitleInput] = useState<string>("");
  const [titlePending, setTitlePending] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [suggestingGate, setSuggestingGate] = useState(false);

  // --- Channel state (only meaningful for post-content / requiresChannel formats) ---
  const requiresChannel = !!format.requiresChannel;
  const parseChannelList = (raw: string | undefined): Channel[] => {
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is Channel => isSocialChannel(s));
  };
  const initialChannels = useMemo<Channel[]>(() => {
    if (!requiresChannel) return [];
    const fromMulti = parseChannelList(channelsFromUrl);
    if (fromMulti.length > 0) return fromMulti;
    if (channelFromUrl && isSocialChannel(channelFromUrl)) return [channelFromUrl];
    const aliasCh = FORMAT_ALIAS_CHANNEL[formatId];
    if (aliasCh && isSocialChannel(aliasCh)) return [aliasCh];
    return [];
  }, [requiresChannel, channelFromUrl, channelsFromUrl, formatId]);

  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [multiChannel, setMultiChannel] = useState<boolean>(
    parseChannelList(channelsFromUrl).length > 1,
  );
  const [lockedByWorkspace, setLockedByWorkspace] = useState(false);

  // Hydrate default channel: workspace item first, then user profile's last-used, else LinkedIn.
  useEffect(() => {
    if (!requiresChannel) return;
    if (channels.length > 0) return;
    let cancelled = false;
    (async () => {
      // 1) workspace item channels lock
      if (wsItemId) {
        const { data: item } = await supabase
          .from("workspace_items")
          .select("channels")
          .eq("id", wsItemId)
          .maybeSingle();
        const socialFromItem = (item?.channels ?? []).filter((c): c is Channel => isSocialChannel(c));
        if (socialFromItem.length > 0 && !cancelled) {
          setChannels([socialFromItem[0]]);
          setLockedByWorkspace(true);
          setMultiChannel(false);
          return;
        }
      }
      // 2) user profile last-used
      const { data: prof } = await supabase
        .from("profiles")
        .select("last_social_channel")
        .maybeSingle();
      const last = prof?.last_social_channel;
      if (!cancelled) {
        if (last && isSocialChannel(last)) setChannels([last]);
        else setChannels(["linkedin"]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requiresChannel, wsItemId, channels.length]);

  // Sync channel state to URL for shareability / refresh persistence.
  useEffect(() => {
    if (!requiresChannel) return;
    const params: Record<string, string | undefined> = {};
    if (multiChannel && channels.length > 1) {
      params.channels = channels.join(",");
      params.channel = undefined;
    } else if (channels.length === 1) {
      params.channel = channels[0];
      params.channels = undefined;
    }
    void navigate({
      to: "/create/$formatId",
      params: { formatId },
      search: (prev: Record<string, unknown>) => ({ ...prev, ...params }),
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, multiChannel, requiresChannel]);



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


  async function runGenerate(providedTitle?: string) {
    if (!seed.trim()) return;
    if (requiresChannel && channels.length === 0) {
      setError("Pick at least one channel to continue.");
      return;
    }
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
          channels: requiresChannel ? channels : undefined,
          title: providedTitle,
        },
      });

      if ("fallback" in res && res.fallback) {
        setError(res.message);
      } else if (res.pendingTitle) {
        // Draft NOT saved yet — user must name it before we persist.
        setSections(res.sections);
        setTitle(null);
        setPendingTitleInput(res.suggestedTitle ?? "");
        setTitlePending(true);
      } else {
        setSections(res.sections);
        setTitle(res.title ?? null);
        setTitlePending(false);
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

  async function confirmTitle() {
    const next = pendingTitleInput.trim();
    if (!next) {
      setError("Please name your draft to continue.");
      return;
    }
    setSavingTitle(true);
    setError(null);
    try {
      await runGenerate(next);
    } finally {
      setSavingTitle(false);
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
    <RequireDefaultsGate>
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Link to="/create" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All formats
        </Link>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{format.category}</span>
      </div>

      <ActiveWorkspacePill />

      <header>
        <h1 className="font-display text-2xl text-foreground">{format.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {requiresChannel && channels.length > 0
            ? channels.length === 1
              ? `Post for ${channels[0][0].toUpperCase() + channels[0].slice(1)}`
              : `Post for ${channels.length} channels`
            : format.description}
        </p>
      </header>

      {requiresChannel && (
        <ChannelPicker
          value={channels}
          onChange={(next) => {
            setChannels(next);
            if (next.length <= 1 && multiChannel) setMultiChannel(false);
          }}
          multi={multiChannel}
          onToggleMulti={() => {
            const next = !multiChannel;
            setMultiChannel(next);
            if (!next && channels.length > 1) setChannels([channels[0]]);
          }}
          locked={lockedByWorkspace}
          lockedReason={lockedByWorkspace ? "Set by workspace" : undefined}
          available={SOCIAL_CHANNELS}
        />
      )}

      <SeedInput
        value={seed}
        onChange={setSeed}
        onSubmit={() => runGenerate()}
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

      {titlePending && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-wide text-primary">Name this draft</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Give your draft a title so it's easy to find later. It won't save until you name it.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              autoFocus
              value={pendingTitleInput}
              onChange={(e) => setPendingTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void confirmTitle(); }
              }}
              maxLength={120}
              placeholder="e.g. Why remote-first is stalling"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={async () => {
                if (!sections.length || suggestingGate) return;
                setSuggestingGate(true);
                setError(null);
                try {
                  const res = await suggestFn({ data: { sections } });
                  setPendingTitleInput(res.title);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not suggest a title");
                } finally {
                  setSuggestingGate(false);
                }
              }}
              disabled={!sections.length || suggestingGate}
              aria-label="Suggest a title from the content"
              title="Suggest a title from the content"
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground hover:text-primary disabled:opacity-40"
            >
              {suggestingGate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setTitlePending(false); setSections([]); }}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void confirmTitle()}
              disabled={!pendingTitleInput.trim() || savingTitle}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {savingTitle ? "Saving…" : "Save draft"}
            </button>
          </div>
        </div>
      )}

      {(hasDraft || busy) && (
        <div className="space-y-3">
          {currentDraftId && !titlePending && (
            <DraftTitleHeader
              title={title}
              draftId={currentDraftId}
              sections={sections}
              onSave={async (next) => {
                const res = await renameFn({ data: { id: currentDraftId, title: next } });
                setTitle(res.title);
                qc.invalidateQueries({ queryKey: ["create-drafts"] });
              }}
            />
          )}
          {busy && formatId === "company-research" && <ResearchProgress />}
          <StreamCanvas sections={sections} busy={busy} />

        </div>
      )}


      {hasDraft && !titlePending && (
        <DecisionDock>
          <button
            onClick={() => runGenerate()}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs text-foreground disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["create-drafts"] })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
          >
            <Save className="h-3.5 w-3.5" /> {workspaceId ? "Saved to Workspace" : "Saved"}
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
    </RequireDefaultsGate>
  );
}

const RESEARCH_STEPS = [
  { at: 0, label: "Mapping site…" },
  { at: 6, label: "Scraping pages…" },
  { at: 14, label: "Gathering external intel…" },
  { at: 24, label: "Synthesizing dossier…" },
];

function ResearchProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, []);
  const current = [...RESEARCH_STEPS].reverse().find((s) => elapsed >= s.at) ?? RESEARCH_STEPS[0];
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-foreground">{current.label}</span>
      <span className="ml-auto tabular-nums text-xs">{elapsed}s</span>
    </div>
  );
}

