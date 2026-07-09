import { createFileRoute } from "@tanstack/react-router";
import { DraftCard } from "@/components/primitives/DraftCard";

export const Route = createFileRoute("/_authenticated/library")({
  component: Library,
});

function Library() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your drafts and posts. Swipe to schedule or regenerate.
        </p>
      </header>

      <div className="space-y-3">
        <DraftCard
          state="empty"
          format="LinkedIn post"
          domain="—"
          body="Nothing here yet. Hold the orb on Home to draft your first post."
        />
      </div>
    </div>
  );
}
