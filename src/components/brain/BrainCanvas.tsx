import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { YouNode } from "./YouNode";
import { BrainNode, type BrainNodeData } from "./BrainNode";
import { EveSheet } from "@/components/primitives/EveSheet";
import type { NodeType } from "@/lib/brain/edges";

const nodeTypes = { you: YouNode, brain: BrainNode };

const VIEWS = [
  { key: "constellation", label: "Constellation" },
  { key: "timeline", label: "Timeline" },
  { key: "radial", label: "Radial" },
  { key: "list", label: "List" },
  { key: "health", label: "Health" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export function BrainCanvas() {
  const [view, setView] = useState<ViewKey>("constellation");
  const [peek, setPeek] = useState<BrainNodeData | null>(null);

  const initial = useMemo<{ nodes: Node[]; edges: Edge[] }>(
    () => ({
      nodes: [
        {
          id: "you",
          type: "you",
          position: { x: 0, y: 0 },
          data: { label: "You", nodeType: "you" satisfies NodeType },
        },
      ],
      edges: [],
    }),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initial.edges);

  // Load existing brain_edges + subscribe to realtime inserts.
  useEffect(() => {
    let mounted = true;

    const addNode = (row: { dst_type: NodeType; dst_id: string }) => {
      const nodeId = `${row.dst_type}:${row.dst_id}`;
      setNodes((prev) => {
        if (prev.some((n) => n.id === nodeId)) return prev;
        const angle = Math.random() * Math.PI * 2;
        const radius = 180 + Math.random() * 120;
        return [
          ...prev,
          {
            id: nodeId,
            type: "brain",
            position: {
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
            },
            data: {
              label: prettyType(row.dst_type),
              nodeType: row.dst_type,
            } satisfies BrainNodeData,
          },
        ];
      });
      void resolveLabel(row);
    };

    // Resolve a human-readable name for the node by looking up its source row.
    const resolveLabel = async (row: { dst_type: NodeType; dst_id: string }) => {
      const label = await fetchLabel(row.dst_type, row.dst_id);
      if (!label || !mounted) return;
      const nodeId = `${row.dst_type}:${row.dst_id}`;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...(n.data as BrainNodeData), label } }
            : n,
        ),
      );
    };

    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) return;

      // Backfill existing edges so nodes appear on load.
      const { data: existing } = await supabase
        .from("brain_edges")
        .select("dst_type, dst_id")
        .eq("user_id", uid);
      if (mounted && existing) {
        for (const row of existing) {
          addNode(row as { dst_type: NodeType; dst_id: string });
        }
      }

      const channel = supabase
        .channel(`brain:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "brain_edges",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            if (!mounted) return;
            const row = payload.new as {
              id: string;
              dst_type: NodeType;
              dst_id: string;
              edge_kind: string;
            };
            addNode(row);
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      mounted = false;
    };
  }, [setNodes]);

  return (
    <div className="relative h-full w-full bg-background">
      {/* Intro burst */}
      <motion.div
        aria-hidden
        initial={{ opacity: 1, scale: 0 }}
        animate={{ opacity: 0, scale: 4 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full amber-glow"
        style={{ background: "oklch(0.82 0.14 82)" }}
      />

      {/* View switcher */}
      <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-border frosted p-1">
        <div className="flex gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                view === v.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "constellation" && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => {
            setPeek(node.data as BrainNodeData);
          }}
          colorMode="dark"
        >
          <Background gap={32} size={1} color="oklch(0.35 0.03 285 / 0.4)" />
          <Controls
            showInteractive={false}
            className="!rounded-lg !border !border-border !bg-surface"
          />
          <MiniMap
            pannable
            zoomable
            maskColor="oklch(0.13 0.03 285 / 0.6)"
            className="!hidden !rounded-lg !border !border-border !bg-surface sm:!block"
          />
        </ReactFlow>
      )}

      {view !== "constellation" && (
        <div className="grid h-full place-items-center text-center">
          <div>
            <div className="font-display text-2xl text-foreground">
              {VIEWS.find((v) => v.key === view)?.label}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Coming next. For now, everything routes through Constellation.
            </p>
          </div>
        </div>
      )}

      <EveSheet
        open={peek !== null}
        onOpenChange={(o) => !o && setPeek(null)}
        title={peek?.label}
      >
        {peek && (
          <div className="space-y-3 pb-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {peek.nodeType.replace(/_/g, " ")}
            </div>
            <p className="text-sm text-foreground">
              Peek details wire in as data lands. Long-press a node in the map
              for actions (Open · Regenerate · Send to Compose · Archive).
            </p>
          </div>
        )}
      </EveSheet>
    </div>
  );
}
