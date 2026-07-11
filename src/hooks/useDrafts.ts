import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDrafts,
  getDraft,
  archiveDraft,
  restoreDraft,
  duplicateDraft,
  moveDraftToWorkspace,
  moveDraftToCampaign,
  scheduleDraft,
  polishDraft,
  updateDraftContext,
  renameDraft,

} from "@/lib/drafts/drafts.functions";

export type DraftFilter = {
  formatId?: string;
  status?: "draft" | "ready" | "archived" | "scheduled" | "published";
  archived?: boolean;
  search?: string;
};

export function useDrafts(filter: DraftFilter = {}) {
  const list = useServerFn(listDrafts);
  return useInfiniteQuery({
    queryKey: ["drafts", filter],
    queryFn: ({ pageParam }) =>
      list({
        data: {
          ...filter,
          cursor: (pageParam as string | null) ?? null,
          limit: 30,
        },
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => {
      if (!last || last.length < 30) return undefined;
      return last[last.length - 1]?.updated_at ?? undefined;
    },
  });
}

export function useDraft(id: string | null | undefined) {
  const get = useServerFn(getDraft);
  return useQuery({
    queryKey: ["draft", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });
}

export function useDraftMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["drafts"] });
    qc.invalidateQueries({ queryKey: ["draft"] });
  };
  const archive = useServerFn(archiveDraft);
  const restore = useServerFn(restoreDraft);
  const dup = useServerFn(duplicateDraft);
  const moveWs = useServerFn(moveDraftToWorkspace);
  const moveCamp = useServerFn(moveDraftToCampaign);
  const sched = useServerFn(scheduleDraft);
  const polish = useServerFn(polishDraft);
  const ctx = useServerFn(updateDraftContext);
  return {
    archive: useMutation({ mutationFn: (id: string) => archive({ data: { id } }), onSuccess: inval }),
    restore: useMutation({ mutationFn: (id: string) => restore({ data: { id } }), onSuccess: inval }),
    duplicate: useMutation({ mutationFn: (id: string) => dup({ data: { id } }), onSuccess: inval }),
    moveWorkspace: useMutation({
      mutationFn: (v: { id: string; workspaceId: string | null; workspaceItemId?: string | null }) =>
        moveWs({ data: v }),
      onSuccess: inval,
    }),
    moveCampaign: useMutation({
      mutationFn: (v: { id: string; campaignId: string | null }) => moveCamp({ data: v }),
      onSuccess: inval,
    }),
    schedule: useMutation({
      mutationFn: (v: { draftId: string; scheduledAt: string; platform: string }) => sched({ data: v }),
      onSuccess: inval,
    }),
    polish: useMutation({
      mutationFn: (v: { id: string; instruction?: string }) => polish({ data: { id: v.id, instruction: v.instruction ?? "Polish for clarity and voice." } }),
      onSuccess: inval,
    }),
    updateContext: useMutation({
      mutationFn: (v: { id: string; presetId?: string | null; voiceId?: string | null; platform?: string | null }) =>
        ctx({ data: v }),
      onSuccess: inval,
    }),
  };
}
