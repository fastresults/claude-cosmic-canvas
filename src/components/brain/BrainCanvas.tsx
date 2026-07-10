import { useState } from "react";
import { motion } from "framer-motion";
import { Scene } from "./three/Scene";
import { BrainSearch } from "./BrainSearch";
import { EveSheet } from "@/components/primitives/EveSheet";
import { useBrainGraph, type GraphNode } from "./three/useBrainGraph";

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
  const { nodes, edges } = useBrainGraph();

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
            nodes={nodes}
            onPick={(node) => {
              setFocusId(node.id);
              setPeek(node);
            }}
          />
          <div className="h-full w-full">
            <Scene nodes={nodes} edges={edges} onPeek={setPeek} focusNodeId={focusId} />
          </div>
        </>
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
