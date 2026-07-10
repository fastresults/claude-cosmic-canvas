import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { NodeType } from "@/lib/brain/edges";
import { NODE_COLOR, TYPE_LABEL } from "./three/palette";

type Props = {
  visibleTypes?: Set<NodeType>;
  hiddenTypes: Set<NodeType>;
  onToggle: (t: NodeType) => void;
};

const ALL_TYPES = Object.keys(TYPE_LABEL) as NodeType[];

export function BrainLegend({ visibleTypes, hiddenTypes, onToggle }: Props) {
  const [expanded, setExpanded] = useState<boolean>(
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  const types = ALL_TYPES.filter((t) => !visibleTypes || visibleTypes.has(t));
  if (types.length === 0) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-24 left-3 z-30 max-h-[45vh] overflow-hidden rounded-md border border-border/60 bg-background/80 backdrop-blur sm:bottom-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1">
          {types.slice(0, 5).map((t) => (
            <span
              key={t}
              className="h-2 w-2 rounded-full"
              style={{ background: NODE_COLOR[t] }}
            />
          ))}
        </span>
        <span>Legend</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <ul className="max-h-[40vh] overflow-y-auto px-1 pb-2 pt-0.5">
          {types.map((t) => {
            const hidden = hiddenTypes.has(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-pressed={!hidden}
                  className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-opacity hover:bg-white/5 ${
                    hidden ? "opacity-40" : "opacity-100"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{
                      background: NODE_COLOR[t],
                      boxShadow: hidden ? "none" : `0 0 6px ${NODE_COLOR[t]}`,
                    }}
                  />
                  <span className="text-foreground/85">{TYPE_LABEL[t]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
