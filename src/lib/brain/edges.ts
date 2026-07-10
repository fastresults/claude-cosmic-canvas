/**
 * Second Brain — typed edge writer.
 * Every generation, edit, and schedule calls this so provenance is auditable.
 * All writes go through the authenticated Supabase client (RLS scopes to user).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type NodeType =
  | "you"
  | "persona"
  | "voice_sample"
  | "directive"
  | "domain"
  | "audience"
  | "knowledge"
  | "entity"
  | "draft"
  | "image"
  | "campaign"
  | "channel"
  | "scheduled"
  | "mcp_client"
  | "preset"
  | "document";

export type EdgeKind =
  | "AUTHORED_BY"
  | "SPEAKS_IN"
  | "EXPERT_IN"
  | "SOURCED_FROM"
  | "PART_OF"
  | "SCHEDULED_TO"
  | "GENERATED_BY_TOOL"
  | "REFERENCES"
  | "REFERENCES_DOC"
  | "REGENERATED_FROM"
  | "PUBLISHED_ON"
  | "USES_VOICE"
  | "TARGETS_AUDIENCE"
  | "SCOPES_DOMAIN";

export type WriteEdgeInput = {
  userId: string;
  srcType: NodeType;
  srcId: string;
  edgeKind: EdgeKind;
  dstType: NodeType;
  dstId: string;
  meta?: Record<string, unknown>;
};

function toRow(i: WriteEdgeInput) {
  return {
    user_id: i.userId,
    src_type: i.srcType,
    src_id: i.srcId,
    edge_kind: i.edgeKind,
    dst_type: i.dstType,
    dst_id: i.dstId,
    meta: (i.meta ?? {}) as Json,
  };
}

export async function writeEdge(input: WriteEdgeInput) {
  const { error } = await supabase.from("brain_edges").insert(toRow(input));
  if (error) console.error("[brain] writeEdge failed", error);
}

export async function writeEdges(inputs: WriteEdgeInput[]) {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("brain_edges").insert(inputs.map(toRow));
  if (error) console.error("[brain] writeEdges failed", error);
}
