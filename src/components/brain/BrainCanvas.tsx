import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { Scene, type ZoomController } from "./three/Scene";
import { BrainSearch } from "./BrainSearch";
import { BrainLegend } from "./BrainLegend";
import { TimelineView } from "./views/TimelineView";
import { RadialView } from "./views/RadialView";
import { ListView } from "./views/ListView";
import { HealthView } from "./views/HealthView";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useBrainGraph, type GraphNode } from "./three/useBrainGraph";
import { useDefaultProfiles } from "@/hooks/useDefaultProfiles";
import type { NodeType } from "@/lib/brain/edges";

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
  const [peek, setPeek] = useState<GraphNode | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const { nodes, edges } = useBrainGraph();
  const zoomRef = useRef<ZoomController | null>(null);

  const visibleTypes = useMemo(
    () => new Set(nodes.map((n) => n.nodeType as NodeType)),
    [nodes],
  );

  const filteredNodes = useMemo(
    () => nodes.filter((n) => !hiddenTypes.has(n.nodeType as NodeType)),
    [nodes, hiddenTypes],
  );

  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [edges, filteredNodes]);

  const toggleType = (t: NodeType) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <div className="relative h-full w-full bg-background">
      {/* Intro burst */}
      <motion.div
        aria-hidden
        initial={{ opacity: 1, scale: 0 }}
        animate={{ opacity: 0, scale: 6 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, #f5e6c8 0%, #f5b642 40%, transparent 70%)",
        }}
      />

      {/* View switcher */}
      <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-md">
        <div className="flex gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                view === v.key
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "constellation" && (
        <>
          <BrainSearch
            nodes={filteredNodes}
            onPick={(node) => {
              setFocusId(node.id);
              setPeek(node);
            }}
          />
          <div className="h-full w-full">
            <Scene
              nodes={filteredNodes}
              edges={filteredEdges}
              onPeek={setPeek}
              focusNodeId={focusId}
              zoomRef={zoomRef}
            />
          </div>
          <BrainLegend
            visibleTypes={visibleTypes}
            hiddenTypes={hiddenTypes}
            onToggle={toggleType}
          />

          {/* Zoom controls */}
          <div className="pointer-events-auto absolute bottom-24 right-3 z-30 flex flex-col overflow-hidden rounded-md border border-border/60 bg-background/80 backdrop-blur sm:bottom-3">
            <button
              type="button"
              onClick={() => zoomRef.current?.zoom(0.8)}
              aria-label="Zoom in"
              className="p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="h-px bg-border/60" />
            <button
              type="button"
              onClick={() => zoomRef.current?.zoom(1.25)}
              aria-label="Zoom out"
              className="p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {view === "timeline" && (
        <TimelineView nodes={filteredNodes} edges={filteredEdges} onPeek={setPeek} />
      )}
      {view === "radial" && (
        <RadialView nodes={filteredNodes} onPeek={setPeek} />
      )}
      {view === "list" && (
        <ListView nodes={filteredNodes} edges={filteredEdges} onPeek={setPeek} />
      )}
      {view === "health" && (
        <HealthView nodes={filteredNodes} edges={filteredEdges} onPeek={setPeek} />
      )}

      <EveSheet
        open={peek !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPeek(null);
            setFocusId(null);
          }
        }}
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
