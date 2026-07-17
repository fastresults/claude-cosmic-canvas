import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { NodeType, EdgeKind } from "@/lib/brain/edges";

export type GraphNode = {
  id: string;
  nodeType: NodeType;
  label: string;
  importance: number; // 1..n, used to size the orb
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
};

const YOU_ID = "you";

function truncate(s: string | null | undefined, n = 40) {
  if (!s) return null;
  const clean = s.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

// NOTE: We intentionally do NOT expose a type-word fallback map for orb labels.
// Per project rule, orbs must render the item's real title / filename / topic —
// never a generic type word like "Draft", "Content", "Image", "Knowledge".
// Nodes are seeded with an empty label and stay label-less until fetchLabel
// resolves a descriptive value.


async function fetchLabel(type: NodeType, id: string): Promise<string | null> {
  switch (type) {
    case "voice_sample": {
      const { data } = await supabase.from("voice_profiles").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "persona": {
      const { data } = await supabase.from("personas").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "directive": {
      const { data } = await supabase.from("voice_directives").select("directive_text").eq("id", id).maybeSingle();
      return truncate(data?.directive_text, 32);
    }
    case "domain": {
      const { data } = await supabase.from("domains").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "audience": {
      const { data } = await supabase.from("audiences").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "preset": {
      const { data } = await supabase.from("presets").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "document": {
      const { data } = await supabase.from("preset_documents").select("file_name, source_url, source_type").eq("id", id).maybeSingle();
      if (!data) return null;
      return truncate(data.file_name ?? data.source_url ?? data.source_type);
    }
    case "knowledge": {
      const { data } = await supabase.from("knowledge_entries").select("title").eq("id", id).maybeSingle();
      return truncate(data?.title);
    }
    case "entity": {
      const { data } = await supabase.from("entities").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    case "draft": {
      const { data } = await supabase
        .from("create_drafts")
        .select("title")
        .eq("id", id)
        .maybeSingle();
      return truncate(data?.title);
    }

    case "image": {
      const { data } = await supabase.from("create_media").select("prompt, url").eq("id", id).maybeSingle();
      if (!data) return null;
      const filename = data.url ? data.url.split("/").pop()?.split("?")[0] ?? null : null;
      return truncate(data.prompt) ?? truncate(filename, 32);
    }


    case "campaign": {
      const { data } = await supabase.from("campaigns").select("title").eq("id", id).maybeSingle();
      return truncate(data?.title);
    }
    case "channel": {
      const { data } = await supabase.from("channel_connections").select("channel, handle").eq("id", id).maybeSingle();
      if (!data) return null;
      return truncate(data.handle ? `${data.channel} · ${data.handle}` : data.channel);
    }
    case "scheduled": {
      const { data } = await supabase.from("schedules").select("channel, scheduled_at").eq("id", id).maybeSingle();
      if (!data) return null;
      const when = data.scheduled_at ? new Date(data.scheduled_at).toLocaleDateString() : null;
      return truncate(when ? `${data.channel} · ${when}` : data.channel);
    }
    case "mcp_client": {
      const { data } = await supabase.from("mcp_clients").select("name").eq("id", id).maybeSingle();
      return truncate(data?.name);
    }
    default:
      return null;
  }
}

export function useBrainGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([
    { id: YOU_ID, nodeType: "you", label: "You", importance: 10 },
  ]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    let mounted = true;

    const addRow = async (row: {
      id: string;
      src_type: NodeType;
      src_id: string;
      dst_type: NodeType;
      dst_id: string;
      edge_kind: EdgeKind;
    }) => {
      const srcId =
        row.src_type === "you" ? YOU_ID : `${row.src_type}:${row.src_id}`;
      const dstId = `${row.dst_type}:${row.dst_id}`;

      if (!mounted) return;
      setNodes((prev) => {
        const next = [...prev];
        for (const [id, type] of [
          [srcId, row.src_type],
          [dstId, row.dst_type],
        ] as const) {
          if (id === YOU_ID) continue;
          if (!next.some((n) => n.id === id)) {
            next.push({
              id,
              nodeType: type,
              label: "",
              importance: 1,
            });
          }
        }
        return next;
      });

      setEdges((prev) => {
        if (prev.some((e) => e.id === row.id)) return prev;
        return [...prev, { id: row.id, source: srcId, target: dstId, kind: row.edge_kind }];
      });

      // Resolve descriptive labels for both endpoints (skip "you").
      const targets: Array<[string, NodeType, string]> = [];
      if (row.src_type !== "you") targets.push([srcId, row.src_type, row.src_id]);
      targets.push([dstId, row.dst_type, row.dst_id]);
      for (const [nodeId, type, rawId] of targets) {
        const label = await fetchLabel(type, rawId);
        if (!label || !mounted) continue;
        setNodes((prev) => prev.map((n) => (n.id === nodeId && !n.label ? { ...n, label } : n)));
      }

    };

    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) return;

      const { data: existing } = await supabase
        .from("brain_edges")
        .select("id, src_type, src_id, dst_type, dst_id, edge_kind")
        .eq("user_id", uid);
      if (existing) {
        for (const row of existing) {
          void addRow(row as never);
        }
      }

      const channel = supabase
        .channel(`brain-graph:${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "brain_edges", filter: `user_id=eq.${uid}` },
          (payload) => {
            void addRow(payload.new as never);
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
  }, []);

  // Recompute importance from edge counts.
  const importanceMap = new Map<string, number>();
  for (const e of edges) {
    importanceMap.set(e.source, (importanceMap.get(e.source) ?? 0) + 1);
    importanceMap.set(e.target, (importanceMap.get(e.target) ?? 0) + 1);
  }
  const withImportance = nodes.map((n) => ({
    ...n,
    importance: n.id === YOU_ID ? 10 : Math.min(6, 1 + (importanceMap.get(n.id) ?? 0)),
  }));

  return { nodes: withImportance, edges };
}
