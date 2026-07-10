import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCreateDrafts } from "@/lib/create/create.functions";

/** Recent drafts across formats (or one). */
export function useRecentCreateDrafts(formatId?: string) {
  const fn = useServerFn(listCreateDrafts);
  return useQuery({
    queryKey: ["create-drafts", formatId ?? "all"],
    queryFn: () => fn({ data: { formatId, includeArchived: false } }),
    staleTime: 30_000,
  });
}
