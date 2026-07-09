import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

/**
 * The root "You" node — amber, frosted glass, always at the graph origin.
 */
function YouNodeInner() {
  return (
    <div
      className="relative grid h-24 w-24 place-items-center rounded-full amber-glow"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, oklch(0.95 0.10 82) 0%, oklch(0.82 0.14 82) 55%, oklch(0.55 0.12 60) 100%)",
      }}
    >
      <span className="font-display text-2xl text-primary-foreground" aria-hidden>
        ✦
      </span>
      <span className="pointer-events-none absolute -bottom-6 whitespace-nowrap text-xs font-medium text-foreground">
        You
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Top} className="opacity-0" />
    </div>
  );
}

export const YouNode = memo(YouNodeInner);
