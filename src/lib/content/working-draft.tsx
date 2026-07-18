import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  contentDraft,
  refineDraft,
  saveDraft,
} from "@/lib/content/content.functions";
import type { RefineKind } from "@/components/primitives/DraftCard";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const DRAFT_STORAGE_KEY = "eve-working-draft-v1";

function readStoredDraft(): WorkingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkingDraft;
    if (typeof parsed?.body === "string" && typeof parsed?.format === "string") return parsed;
  } catch { /* ignore malformed */ }
  return null;
}

function writeStoredDraft(draft: WorkingDraft | null) {
  if (typeof window === "undefined") return;
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch { /* quota / disabled — best-effort */ }
}

export type WorkingDraft = {
  body: string;
  format: string;
  prompt: string;
};

type Ctx = {
  draft: WorkingDraft | null;
  busy: boolean;
  saving: boolean;
  error: string | null;
  generate: (prompt: string) => Promise<void>;
  refine: (kind: RefineKind, custom?: string) => Promise<void>;
  save: () => Promise<void>;
  discard: () => void;
};

const WorkingDraftContext = createContext<Ctx | null>(null);

const REFINE_PROMPTS: Record<RefineKind, string> = {
  regen: "Rewrite this from scratch with the same intent but a fresh angle.",
  tighten: "Tighten this. Cut filler. Keep the message and voice.",
  tone: "Shift the tone to be warmer and more conversational without losing substance.",
};

export function WorkingDraftProvider({ children }: { children: ReactNode }) {
  const generateFn = useServerFn(contentDraft);
  const refineFn = useServerFn(refineDraft);
  const saveFn = useServerFn(saveDraft);
  const qc = useQueryClient();

  const [draft, setDraft] = useState<WorkingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (prompt: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await generateFn({ data: { prompt, format: "post" } });
        setDraft({ body: res.body, format: res.format, prompt: res.prompt });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate");
      } finally {
        setBusy(false);
      }
    },
    [generateFn],
  );

  const refine = useCallback(
    async (kind: RefineKind, custom?: string) => {
      if (!draft) return;
      setBusy(true);
      setError(null);
      try {
        const instruction = custom ?? REFINE_PROMPTS[kind];
        const res = await refineFn({
          data: {
            currentBody: draft.body,
            instruction,
            format: draft.format,
          },
        });
        setDraft({ ...draft, body: res.body });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to refine");
      } finally {
        setBusy(false);
      }
    },
    [draft, refineFn],
  );

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await saveFn({
        data: {
          body: draft.body,
          format: draft.format,
          prompt: draft.prompt,
        },
      });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["drafts"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft, saveFn, qc]);

  const discard = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ draft, busy, saving, error, generate, refine, save, discard }),
    [draft, busy, saving, error, generate, refine, save, discard],
  );

  return (
    <WorkingDraftContext.Provider value={value}>
      {children}
    </WorkingDraftContext.Provider>
  );
}

export function useWorkingDraft() {
  const ctx = useContext(WorkingDraftContext);
  if (!ctx) throw new Error("useWorkingDraft must be used inside WorkingDraftProvider");
  return ctx;
}
