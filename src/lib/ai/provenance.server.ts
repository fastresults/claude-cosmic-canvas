// Server-side Second Brain edge writer. Uses per-request authenticated
// Supabase client from requireSupabaseAuth middleware context.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { EdgeKind, NodeType, WriteEdgeInput } from "@/lib/brain/edges";

type AuthedSupabase = SupabaseClient<Database>;

export type ServerEdgeInput = Omit<WriteEdgeInput, "userId">;

export async function writeEdgeServer(
  supabase: AuthedSupabase,
  userId: string,
  input: ServerEdgeInput,
) {
  const { error } = await supabase.from("brain_edges").insert({
    user_id: userId,
    src_type: input.srcType,
    src_id: input.srcId,
    edge_kind: input.edgeKind,
    dst_type: input.dstType,
    dst_id: input.dstId,
    meta: (input.meta ?? {}) as Json,
  });
  if (error) console.error("[brain.server] writeEdge failed", error);
}

export async function writeEdgesServer(
  supabase: AuthedSupabase,
  userId: string,
  inputs: ServerEdgeInput[],
) {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("brain_edges").insert(
    inputs.map((i) => ({
      user_id: userId,
      src_type: i.srcType,
      src_id: i.srcId,
      edge_kind: i.edgeKind,
      dst_type: i.dstType,
      dst_id: i.dstId,
      meta: (i.meta ?? {}) as Json,
    })),
  );
  if (error) console.error("[brain.server] writeEdges failed", error);
}

/** Record an AI generation event: prompt → output, tagged with model + usage. */
export async function recordGeneration(
  supabase: AuthedSupabase,
  userId: string,
  args: {
    tool: "claude" | "gateway";
    model: string;
    srcType: NodeType;
    srcId: string;
    dstType: NodeType;
    dstId: string;
    edgeKind?: EdgeKind;
    usage?: Record<string, unknown>;
    extra?: Record<string, unknown>;
  },
) {
  await writeEdgeServer(supabase, userId, {
    srcType: args.srcType,
    srcId: args.srcId,
    dstType: args.dstType,
    dstId: args.dstId,
    edgeKind: args.edgeKind ?? "GENERATED_BY_TOOL",
    meta: {
      tool: args.tool,
      model: args.model,
      usage: args.usage,
      ...args.extra,
    },
  });
}
