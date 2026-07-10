import { useMemo, useState } from "react";
import type { GraphNode, GraphEdge } from "@/components/brain/three/useBrainGraph";
import type { NodeType } from "@/lib/brain/edges";
import { NODE_COLOR, TYPE_LABEL } from "@/components/brain/three/palette";
import { AskEveBar } from "./AskEveBar";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPeek: (n: GraphNode) => void;
};

type Range = "today" | "7d" | "30d" | "all";
const RANGE_DAYS: Record<Range, number | null> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  all: null,
};

// Nodes don't carry created_at; approximate via edge ordering (later ids = later).
// Fall back to insertion order for stable grouping headers.
function edgeTimestampByNode(edges: GraphEdge[]): Map<string, number> {
  const t = new Map<string, number>();
  edges.forEach((e, i) => {
    if (!t.has(e.source)) t.set(e.source, i);
    if (!t.has(e.target)) t.set(e.target, i);
  });
  return t;
}

export function TimelineView({ nodes, edges, onPeek }: Props) {
  const [range, setRange] = useState<Range>("7d");
  const order = useMemo(() => edgeTimestampByNode(edges), [edges]);

  const sorted = useMemo(() => {
    const arr = nodes.filter((n) => n.id !== "you");
    arr.sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
    // Windowing: since we lack real timestamps, treat range as a "recent N" slice.
    const days = RANGE_DAYS[range];
    if (days === null) return arr;
    const cap = Math.max(3, days * 2);
    return arr.slice(0, cap);
  }, [nodes, order, range]);

  const ranges: { key: Range; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 pt-16">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              range === r.key
                ? "border-accent bg-accent/15 text-accent"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-3 pb-2 pt-3">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-elev p-8 text-center text-sm text-muted-foreground">
            Nothing captured in this window. Add a source or draft to start
            populating your Brain.
          </div>
        ) : (
          <ul className="space-y-1">
            {sorted.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onPeek(n)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/40 bg-card/60 px-3 py-2 text-left hover:bg-surface-elev"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: NODE_COLOR[n.nodeType as NodeType],
                      boxShadow: `0 0 6px ${NODE_COLOR[n.nodeType as NodeType]}`,
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {n.label}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[n.nodeType as NodeType]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AskEveBar
        placeholder={`Ask about the last ${range === "all" ? "everything" : range}…`}
        contextPreamble={`Context: my Brain, last ${range}, ${sorted.length} nodes.`}
      />
    </div>
  );
}
