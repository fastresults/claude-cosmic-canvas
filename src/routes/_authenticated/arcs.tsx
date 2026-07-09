import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/arcs")({
  component: Arcs,
});

function Arcs() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Arcs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-week campaigns. Plan once, ship every week.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No arcs yet. Try saying{" "}
          <span className="text-foreground">
            "plan a 6-week launch campaign"
          </span>{" "}
          from Home.
        </p>
      </div>
    </div>
  );
}
