/**
 * Second Brain — typed edge writer.
 * Every generation, edit, and schedule calls this so provenance is auditable.
 * All writes go through the authenticated Supabase client (RLS scopes to user).
 */
import { supabase } from "@/integrations/supabase/client";

export type NodeType =
  | "you"
  | "persona"
  | "voice_sample"
  | "directive"
  | "domain"
  | "knowledge"
  | "entity"
  | "draft"
  | "image"
  | "campaign"
  | "channel"
  | "scheduled"
  | "mcp_client";

export type EdgeKind =
  | "AUTHORED_BY"
  | "SPEAKS_IN"
  | "EXPERT_IN"
  | "SOURCED_FROM"
  | "PART_OF"
  | "SCHEDULED_TO"
  | "GENERATED_BY_TOOL"
  | "REFERENCES"
  | "REGENERATED_FROM"
  | "PUBLISHED_ON";

export type WriteEdgeInput = {
  userId: string;
  srcType: NodeType;
  srcId: string;
  edgeKind: EdgeKind;
  dstType: NodeType;
  dstId: string;
  meta?: Record<string, unknown>;
};

export async function writeEdge(input: WriteEdgeInput) {
  const { error } = await supabase.from("brain_edges").insert({
    user_id: input.userId,
    src_type: input.srcType,
    src_id: input.srcId,
    edge_kind: input.edgeKind,
    dst_type: input.dstType,
    dst_id: input.dstId,
    meta: input.meta ?? {},
  });
  if (error) console.error("[brain] writeEdge failed", error);
}

export async function writeEdges(inputs: WriteEdgeInput[]) {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("brain_edges").insert(
    inputs.map((i) => ({
      user_id: i.userId,
      src_type: i.srcType,
      src_id: i.srcId,
      edge_kind: i.edgeKind,
      dst_type: i.dstType,
      dst_id: i.dstId,
      meta: i.meta ?? {},
    })),
  );
  if (error) console.error("[brain] writeEdges failed", error);
}
