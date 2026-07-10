/**
 * Global workspace context store. Any save/generate path in the app reads
 * from here (and from URL) so drafts stay scoped to the workspace that
 * created them, even across async writes.
 */
import { create } from "zustand";

type WorkspaceContext = {
  workspaceId: string | null;
  workspaceItemId: string | null;
  setContext: (workspaceId: string | null, workspaceItemId?: string | null) => void;
  clearContext: () => void;
};

export const useWorkspaceContext = create<WorkspaceContext>((set) => ({
  workspaceId: null,
  workspaceItemId: null,
  setContext: (workspaceId, workspaceItemId = null) =>
    set({ workspaceId, workspaceItemId }),
  clearContext: () => set({ workspaceId: null, workspaceItemId: null }),
}));

/** Snapshot read for async save handlers — fresh, not stale-closure. */
export function readWorkspaceContext() {
  const s = useWorkspaceContext.getState();
  return { workspace_id: s.workspaceId, workspace_item_id: s.workspaceItemId };
}
