import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { GraphNode } from "@/components/brain/three/useBrainGraph";
import type { NodeType } from "@/lib/brain/edges";
import { NODE_COLOR, TYPE_LABEL } from "@/components/brain/three/palette";
import { AskEveBar } from "./AskEveBar";

type Props = {
  nodes: GraphNode[];
  onPeek: (n: GraphNode) => void;
};

type RingKey = "identity" | "knowledge" | "audience" | "output";

const RING_DEFS: {
  key: RingKey;
  label: string;
  types: NodeType[];
  strengthen: { text: string; to: string };
}[] = [
  {
    key: "identity",
    label: "Identity",
    types: ["persona", "voice_sample", "directive"],
    strengthen: { text: "Add a voice sample", to: "/settings/voice" },
  },
  {
    key: "knowledge",
    label: "Knowledge",
    types: ["domain", "knowledge", "document"],
    strengthen: { text: "Add a domain source", to: "/settings/domains" },
  },
  {
    key: "audience",
    label: "Audience",
    types: ["audience", "entity"],
    strengthen: { text: "Add an audience", to: "/settings/presets" },
  },
  {
    key: "output",
    label: "Output",
    types: ["draft", "image", "campaign", "channel", "scheduled"],
    strengthen: { text: "Compose a draft", to: "/" },
  },
];

export function RadialView({ nodes, onPeek }: Props) {
  const rings = useMemo(
    () =>
      RING_DEFS.map((r) => ({
        ...r,
        items: nodes
          .filter((n) => r.types.includes(n.nodeType as NodeType))
          .sort((a, b) => b.importance - a.importance),
      })),
    [nodes],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-3 pb-2 pt-16">
        <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            You
          </div>
          <div className="text-xs text-muted-foreground">
            Your Brain, layered outward from you.
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {rings.map((ring) => (
            <section
              key={ring.key}
              className="rounded-lg border border-border/60 bg-card/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {ring.label}
                  <span className="ml-2 text-foreground/70">{ring.items.length}</span>
                </h3>
              </div>
              {ring.items.length === 0 ? (
                <Link
                  to={ring.strengthen.to}
                  className="block rounded-md border border-dashed border-border bg-surface-elev px-3 py-3 text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  Empty ring — {ring.strengthen.text} →
                </Link>
              ) : (
                <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1">
                  {ring.items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onPeek(n)}
                      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs hover:bg-surface-elev"
                      title={TYPE_LABEL[n.nodeType as NodeType]}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: NODE_COLOR[n.nodeType as NodeType] }}
                      />
                      <span className="truncate text-foreground/85">{n.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      <AskEveBar
        placeholder="Ask about your identity, knowledge, audience or output…"
        contextPreamble="Context: my Brain, radial rings around You."
      />
    </div>
  );
}
