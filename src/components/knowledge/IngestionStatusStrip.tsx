import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { KnowledgeJob } from "./shared";

const STAGE_LABEL: Record<string, string> = {
  queued: "Queued",
  parsing: "Parsing…",
  extracting: "Extracting…",
  embedding: "Embedding…",
  done: "Ready",
  error: "Error",
};

export function IngestionStatusStrip({ userId }: { userId: string | null }) {
  const [active, setActive] = useState<KnowledgeJob | null>(null);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`kb-jobs:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "knowledge_ingestion_jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as KnowledgeJob | null;
          if (!row) return;
          setActive(row);
          if (row.status === "done" || row.status === "error") {
            setTimeout(() => setActive((cur) => (cur?.id === row.id ? null : cur)), 3500);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!active) return null;
  const Icon =
    active.status === "done"
      ? CheckCircle2
      : active.status === "error"
        ? XCircle
        : Loader2;

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        active.status === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : active.status === "done"
            ? "border-accent/40 bg-accent/10 text-accent-foreground"
            : "border-border bg-surface-elev text-muted-foreground"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${active.status !== "done" && active.status !== "error" ? "animate-spin" : ""}`}
      />
      <span>
        {STAGE_LABEL[active.status] ?? active.status}
        {active.stage_message ? ` · ${active.stage_message}` : ""}
        {active.error ? ` · ${active.error}` : ""}
      </span>
    </div>
  );
}
