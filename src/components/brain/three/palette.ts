import type { NodeType, EdgeKind } from "@/lib/brain/edges";

// Hex colors (three.js needs actual color values, not CSS vars).
export const NODE_COLOR: Record<NodeType, string> = {
  you: "#f5b642",
  persona: "#f5b642",
  voice_sample: "#e89838",
  directive: "#d97b2b",
  domain: "#a78bfa",
  audience: "#c4b5fd",
  knowledge: "#5eead4",
  entity: "#34d399",
  draft: "#e5e7eb",
  image: "#f0abfc",
  campaign: "#fb7185",
  channel: "#60a5fa",
  scheduled: "#38bdf8",
  mcp_client: "#94a3b8",
  preset: "#facc15",
  document: "#5eead4",
};

export const EDGE_COLOR: Record<EdgeKind, string> = {
  AUTHORED_BY: "#f5b642",
  SPEAKS_IN: "#f5b642",
  EXPERT_IN: "#a78bfa",
  SOURCED_FROM: "#5eead4",
  PART_OF: "#fb7185",
  SCHEDULED_TO: "#38bdf8",
  GENERATED_BY_TOOL: "#94a3b8",
  REFERENCES: "#e5e7eb",
  REFERENCES_DOC: "#5eead4",
  REGENERATED_FROM: "#94a3b8",
  PUBLISHED_ON: "#60a5fa",
  USES_VOICE: "#f5b642",
  TARGETS_AUDIENCE: "#c4b5fd",
  SCOPES_DOMAIN: "#a78bfa",
};

export const TYPE_LABEL: Record<NodeType, string> = {
  you: "You",
  persona: "Persona",
  voice_sample: "Voice",
  directive: "Directive",
  domain: "Domain",
  audience: "Audience",
  knowledge: "Knowledge",
  entity: "Entity",
  draft: "Content",
  image: "Image",
  campaign: "Campaign",
  channel: "Channel",
  scheduled: "Scheduled",
  mcp_client: "MCP Client",
  preset: "Preset",
  document: "Document",
};
