import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/components/brain/three/useBrainGraph";
import type { NodeType } from "@/lib/brain/edges";
import { NODE_COLOR, TYPE_LABEL } from "@/components/brain/three/palette";
import { AskEveBar } from "./AskEveBar";

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onPeek: (n: GraphNode) => void;
};

type Smart = "recency" | "underused" | "missing";

export function ListView({ nodes, edges, onPeek }: Props) {
  const [q, setQ] = useState("");
  const [smart, setSmart] = useState<Smart>("recency");

  const edgeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    }
    return m;
  }, [edges]);

  const grouped = useMemo(() => {
    const filtered = nodes
      .filter((n) => n.id !== "you")
      .filter((n) => (q ? n.label.toLowerCase().includes(q.toLowerCase()) : true))
      .filter((n) => {
        if (smart === "underused") return (edgeCount.get(n.id) ?? 0) <= 1;
        return true;
      });

    const byType = new Map<NodeType, GraphNode[]>();
    for (const n of filtered) {
      const t = n.nodeType as NodeType;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(n);
    }

    if (smart === "missing") {
      // Show every known type; empty ones surface as gaps.
      (Object.keys(TYPE_LABEL) as NodeType[]).forEach((t) => {
        if (!byType.has(t)) byType.set(t, []);
      });
    }

    return Array.from(byType.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [nodes, q, smart, edgeCount]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto w-full max-w-2xl px-3 pt-16">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Brain…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {(["recency", "underused", "missing"] as Smart[]).map((s) => (
            <button
              key={s}
              onClick={() => setSmart(s)}
              className={`rounded-full border px-2.5 py-1 capitalize ${
                smart === s
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-3 pb-2 pt-3">
        {grouped.map(([type, items]) => (
          <section key={type} className="mb-3">
            <h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: NODE_COLOR[type] }}
              />
              {TYPE_LABEL[type]}
              <span className="text-foreground/70">{items.length}</span>
            </h3>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-elev px-3 py-2 text-xs text-muted-foreground">
                No {TYPE_LABEL[type].toLowerCase()} yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onPeek(n)}
                      className="flex w-full items-center gap-3 rounded-md border border-border/40 bg-card/60 px-3 py-1.5 text-left hover:bg-surface-elev"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {n.label}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {edgeCount.get(n.id) ?? 0} links
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <AskEveBar
        placeholder="Ask about anything in your list…"
        contextPreamble={`Context: Brain list, smart=${smart}, query="${q}".`}
      />
    </div>
  );
}
