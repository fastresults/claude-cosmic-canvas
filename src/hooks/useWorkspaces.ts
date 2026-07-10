import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWorkspaces, getWorkspace } from "@/lib/workspaces/workspaces.functions";

export function useWorkspaces(includeArchived = false) {
  const fn = useServerFn(listWorkspaces);
  return useQuery({
    queryKey: ["workspaces", includeArchived],
    queryFn: () => fn({ data: { includeArchived } }),
    staleTime: 15_000,
  });
}

export function useWorkspace(id: string | null | undefined) {
  const fn = useServerFn(getWorkspace);
  return useQuery({
    queryKey: ["workspace", id],
    queryFn: () => fn({ data: { id: id! } }),
    enabled: !!id,
    staleTime: 10_000,
  });
}
