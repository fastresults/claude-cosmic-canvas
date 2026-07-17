import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { GraphNode, GraphEdge } from "@/components/brain/three/useBrainGraph";
import type { NodeType } from "@/lib/brain/edges";
import { NODE_COLOR, TYPE_LABEL } from "@/components/brain/three/palette";
import { AskEveBar } from "./AskEveBar";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPeek: (n: GraphNode) => void;
};

const CORE_TYPES: { type: NodeType; label: string; to: string }[] = [
  { type: "voice_sample", label: "Voice", to: "/settings/voice" },
  { type: "domain", label: "Domain", to: "/settings/domains" },
  { type: "audience", label: "Audience", to: "/settings/presets" },
  { type: "knowledge", label: "Knowledge", to: "/settings/knowledge" },
  { type: "draft", label: "Content", to: "/" },
];

export function HealthView({ nodes, edges, onPeek }: Props) {
  const stats = useMemo(() => {
    const byType = new Map<NodeType, number>();
    for (const n of nodes) {
      if (n.id === "you") continue;
      const t = n.nodeType as NodeType;
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }
    const covered = CORE_TYPES.filter((c) => (byType.get(c.type) ?? 0) > 0);
    const missing = CORE_TYPES.filter((c) => (byType.get(c.type) ?? 0) === 0);

    const linked = new Set<string>();
    for (const e of edges) {
      linked.add(e.source);
      linked.add(e.target);
    }
    const orphans = nodes.filter((n) => n.id !== "you" && !linked.has(n.id));

    const max = Math.max(1, ...Array.from(byType.values()));

    return { byType, covered, missing, orphans, max };
  }, [nodes, edges]);

  const coveragePct = Math.round((stats.covered.length / CORE_TYPES.length) * 100);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto px-3 pb-2 pt-16">
        {/* Coverage */}
        <section className="rounded-lg border border-border/60 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coverage
            </h3>
            <span className="text-2xl font-semibold text-foreground">
              {coveragePct}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elev">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          {stats.missing.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {stats.missing.map((m) => (
                <Link
                  key={m.type}
                  to={m.to}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  + {m.label}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Balance */}
        <section className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Balance
          </h3>
          <ul className="space-y-1.5">
            {Array.from(stats.byType.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([t, c]) => (
                <li key={t} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-muted-foreground">
                    {TYPE_LABEL[t]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elev">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c / stats.max) * 100}%`,
                        background: NODE_COLOR[t],
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-foreground/80">{c}</span>
                </li>
              ))}
          </ul>
        </section>

        {/* Orphans */}
        <section className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Orphans
            <span className="ml-2 text-foreground/70">{stats.orphans.length}</span>
          </h3>
          {stats.orphans.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Every node connects somewhere. Nice.
            </p>
          ) : (
            <ul className="space-y-1">
              {stats.orphans.slice(0, 10).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => onPeek(n)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-surface-elev"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: NODE_COLOR[n.nodeType as NodeType] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground/85">
                      {n.label}
                    </span>
                    <span className="text-muted-foreground">Connect →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AskEveBar
        placeholder="Ask about your Brain health…"
        contextPreamble={`Context: Brain health — coverage ${coveragePct}%, ${stats.orphans.length} orphans, missing ${stats.missing.map((m) => m.label).join(", ") || "none"}.`}
      />
    </div>
  );
}
