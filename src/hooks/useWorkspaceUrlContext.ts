import { useEffect } from "react";
import { useWorkspaceContext } from "@/lib/workspaces/workspaceContextStore";

/**
 * Reads `?wsId=…&wsItemId=…` from the current URL on mount and pushes it
 * into the workspace context store. On unmount (or when the URL loses
 * `wsId`), aggressively clears stale context.
 */
export function useWorkspaceUrlContext(wsId?: string | null, wsItemId?: string | null) {
  const setContext = useWorkspaceContext((s) => s.setContext);
  const clearContext = useWorkspaceContext((s) => s.clearContext);

  useEffect(() => {
    if (wsId) setContext(wsId, wsItemId ?? null);
    else clearContext();
    return () => clearContext();
  }, [wsId, wsItemId, setContext, clearContext]);
}
