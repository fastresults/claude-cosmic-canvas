import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDefaultProfiles,
  createDefaultProfile,
  updateDefaultProfile,
  deleteDefaultProfile,
  favoriteDefaultProfile,
  setDefaultDefaultProfile,
  applyDefaultProfile,
} from "@/lib/profiles/profiles.functions";

export const DEFAULT_PROFILES_KEY = ["default-profiles"] as const;

type CreateInput = {
  name: string;
  description?: string | null;
  emoji?: string | null;
  voice_id?: string | null;
  knowledge_profile_id?: string | null;
  domain_id?: string | null;
};
type UpdateInput = Partial<CreateInput> & { id: string };

export function useDefaultProfiles() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDefaultProfiles);
  const createFn = useServerFn(createDefaultProfile);
  const updateFn = useServerFn(updateDefaultProfile);
  const deleteFn = useServerFn(deleteDefaultProfile);
  const favFn = useServerFn(favoriteDefaultProfile);
  const defaultFn = useServerFn(setDefaultDefaultProfile);
  const applyFn = useServerFn(applyDefaultProfile);

  const query = useQuery({
    queryKey: DEFAULT_PROFILES_KEY,
    queryFn: () => listFn(),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: DEFAULT_PROFILES_KEY });
    // Applying a profile mutates the three underlying defaults.
    qc.invalidateQueries({ queryKey: ["voice-active"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "profiles"] });
    qc.invalidateQueries({ queryKey: ["settings", "domains"] });
  };

  return {
    profiles: query.data ?? [],
    isLoading: query.isLoading,
    activeProfile: (query.data ?? []).find((p) => p.is_default) ?? null,
    create: useMutation({
      mutationFn: (v: CreateInput) => createFn({ data: v as never }),
      onSuccess: invalidateAll,
    }),
    update: useMutation({
      mutationFn: (v: UpdateInput) => updateFn({ data: v as never }),
      onSuccess: invalidateAll,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFn({ data: { id } }),
      onSuccess: invalidateAll,
    }),
    favorite: useMutation({
      mutationFn: (v: { id: string; favorite: boolean }) => favFn({ data: v }),
      onSuccess: invalidateAll,
    }),
    setDefault: useMutation({
      mutationFn: (id: string | null) => defaultFn({ data: { id } }),
      onSuccess: invalidateAll,
    }),
    apply: useMutation({
      mutationFn: (id: string) => applyFn({ data: { id } }),
      onSuccess: invalidateAll,
    }),
  };
}
