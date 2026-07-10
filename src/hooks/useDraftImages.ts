import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDraftImages,
  attachDraftImage,
  removeDraftImage,
  generateImageConcepts,
  listImageStyles,
} from "@/lib/drafts/drafts.functions";

export function useImageStyles(role: "cover" | "social" | "inline") {
  const fn = useServerFn(listImageStyles);
  return useQuery({
    queryKey: ["image-styles", role],
    queryFn: () => fn({ data: { role } }),
    staleTime: 5 * 60_000,
  });
}


export function useDraftImages(draftId: string | null | undefined) {
  const list = useServerFn(listDraftImages);
  return useQuery({
    queryKey: ["draft-images", draftId],
    queryFn: () => list({ data: { draftId: draftId! } }),
    enabled: !!draftId,
  });
}

export function useImageConcepts() {
  const fn = useServerFn(generateImageConcepts);
  return useMutation({
    mutationFn: (draftId: string) => fn({ data: { draftId } }),
  });
}

export function useAttachDraftImage(draftId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(attachDraftImage);
  return useMutation({
    mutationFn: (v: {
      role: "cover" | "social" | "inline";
      url: string;
      prompt?: string | null;
      styleId?: string | null;
      aspectRatio?: string | null;
      parentImageId?: string | null;
      generatedBy: "gpt-image-2" | "gemini" | "upload" | "library";
    }) => fn({ data: { draftId, ...v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draft-images", draftId] });
      qc.invalidateQueries({ queryKey: ["draft", draftId] });
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}

export function useRemoveDraftImage(draftId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(removeDraftImage);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["draft-images", draftId] });
      qc.invalidateQueries({ queryKey: ["drafts"] });
    },
  });
}
