import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { orchestrate } from "@/lib/orchestrator/orchestrate.functions";
import { ORCHESTRATOR_MODEL } from "@/lib/orchestrator/config";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const runOrchestrate = useServerFn(orchestrate);
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRun() {
    setError(null);
    setResponse("");
    setLoading(true);
    try {
      const result = await runOrchestrate({ data: { prompt } });
      setResponse(result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Orchestrator smoke test
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Calls Anthropic via a server function using{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {ORCHESTRATOR_MODEL}
            </code>
            . Replace this page once your PRD is wired up.
          </p>
        </header>

        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the orchestrator something..."
            className="min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={onRun}
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run"}
          </button>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {response && (
            <div className="whitespace-pre-wrap rounded-md border border-border bg-card p-4 text-sm text-card-foreground">
              {response}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
