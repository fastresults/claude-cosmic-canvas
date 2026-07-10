import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeType } from "@/lib/brain/edges";

export type BrainNodeData = {
  label: string;
  nodeType: NodeType;
  icon?: string;
};

const TYPE_COLOR: Record<NodeType, string> = {
  you: "var(--color-brain-amber)",
  persona: "var(--color-brain-amber)",
  voice_sample: "var(--color-brain-amber)",
  directive: "var(--color-brain-amber)",
  domain: "var(--color-brain-violet)",
  audience: "var(--color-brain-violet)",
  knowledge: "var(--color-brain-teal)",
  entity: "var(--color-brain-teal)",
  draft: "var(--color-foreground)",
  image: "var(--color-foreground)",
  campaign: "var(--color-brain-rose)",
  channel: "var(--color-brain-blue)",
  scheduled: "var(--color-brain-blue)",
  mcp_client: "var(--color-brain-slate)",
  preset: "var(--color-brain-amber)",
  document: "var(--color-brain-teal)",
};

const TYPE_ICON: Record<NodeType, string> = {
  you: "✦",
  persona: "◐",
  voice_sample: "〰",
  directive: "⚑",
  domain: "✎",
  audience: "☍",
  knowledge: "📄",
  entity: "◆",
  draft: "▨",
  image: "🖼",
  campaign: "⌁",
  channel: "↗",
  scheduled: "⏱",
  mcp_client: "⌘",
  preset: "✧",
  document: "📎",
};

function BrainNodeInner({ data }: { data: BrainNodeData }) {
  const color = TYPE_COLOR[data.nodeType];
  const icon = data.icon ?? TYPE_ICON[data.nodeType];

  return (
    <div className="relative">
      <div
        className="grid h-14 w-14 place-items-center rounded-full frosted transition-transform hover:scale-110"
        style={{
          boxShadow: `inset 0 0 0 1px ${color}, 0 0 20px 2px color-mix(in oklab, ${color} 30%, transparent)`,
        }}
      >
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
      </div>
      <span className="pointer-events-none absolute -bottom-5 left-1/2 max-w-[110px] -translate-x-1/2 truncate text-center text-[10px] text-muted-foreground">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Top} className="opacity-0" />
    </div>
  );
}

export const BrainNode = memo(BrainNodeInner);
