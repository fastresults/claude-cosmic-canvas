import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPresets,
  createPreset,
  updatePreset,
  deletePreset,
  archivePreset,
  favoritePreset,
  setDefaultPreset,
} from "@/lib/presets/presets.functions";

export const PRESETS_KEY = ["presets"] as const;

// Deliberately loose input types — the server fns own validation via Zod.
type CreateInput = {
  name: string;
  description?: string | null;
  brief_config?: Record<string, unknown>;
  selected_domain_ids?: string[];
  selected_audience_ids?: string[];
  factor_weights?: Record<string, number>;
  research_context?: Record<string, unknown>;
};
type UpdateInput = Partial<CreateInput> & { id: string };

export function usePresets() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPresets);
  const createFn = useServerFn(createPreset);
  const updateFn = useServerFn(updatePreset);
  const deleteFn = useServerFn(deletePreset);
  const archiveFn = useServerFn(archivePreset);
  const favFn = useServerFn(favoritePreset);
  const defaultFn = useServerFn(setDefaultPreset);

  const query = useQuery({
    queryKey: PRESETS_KEY,
    queryFn: () => listFn(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: PRESETS_KEY });

  return {
    presets: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    create: useMutation({
      mutationFn: (v: CreateInput) => createFn({ data: v as never }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: UpdateInput) => updateFn({ data: v as never }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFn({ data: { id } }),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => archiveFn({ data: { id } }),
      onSuccess: invalidate,
    }),
    favorite: useMutation({
      mutationFn: (v: { id: string; favorite: boolean }) => favFn({ data: v }),
      onSuccess: invalidate,
    }),
    setDefault: useMutation({
      mutationFn: (id: string | null) => defaultFn({ data: { id } }),
      onSuccess: invalidate,
    }),
  };
}

