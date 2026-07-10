import { Link } from "@tanstack/react-router";
import { Target, X } from "lucide-react";
import { useWorkspaceContext } from "@/lib/workspaces/workspaceContextStore";
import { useWorkspace } from "@/hooks/useWorkspaces";

/**
 * Persistent context chip shown on Compose / Create surfaces whenever a
 * workspace context is active. Mirrors ActivePresetPill. Tap → workspace.
 */
export function ActiveWorkspacePill() {
  const workspaceId = useWorkspaceContext((s) => s.workspaceId);
  const clearContext = useWorkspaceContext((s) => s.clearContext);
  const { data } = useWorkspace(workspaceId);
  if (!workspaceId) return null;

  const title = data?.workspace?.title ?? "Workspace";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 pl-2 pr-1 py-1 text-xs text-foreground">
      <Target className="h-3 w-3 text-accent" />
      <Link
        to="/workspaces/$id"
        params={{ id: workspaceId }}
        className="truncate max-w-[160px] hover:underline"
      >
        {title}
      </Link>
      <button
        type="button"
        aria-label="Leave workspace context"
        onClick={() => clearContext()}
        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
