import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiThink } from "@/lib/ai/ai.functions";
import { Pill } from "@/components/primitives/Pill";
import { Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/arcs")({
  component: Arcs,
});

type Campaign = {
  id: string;
  title: string;
  start_date: string | null;
  arc: unknown;
  created_at: string;
};

function Arcs() {
  const think = useServerFn(aiThink);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, title, start_date, arc, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (prompt: string) => {
      const arc = await think({
        data: {
          system:
            "You plan multi-week content arcs. Return JSON only: " +
            '{"weeks":[{"theme":string,"posts":[{"format":string,"hook":string}]}]}',
          prompt: `Plan a 4-week content arc for: ${prompt}`,
        },
      });
      let parsed: unknown = { weeks: [] };
      try {
        parsed = JSON.parse(arc.text.trim().replace(/^```(?:json)?|```$/g, ""));
      } catch { /* keep default */ }
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not signed in");
      const { error } = await supabase.from("campaigns").insert({
        user_id: user.user.id,
        title: prompt.slice(0, 80),
        arc: parsed as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-40">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Arcs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-week campaigns. Plan once, ship every week.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Plan a new arc
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 6-week launch for our v2 API"
            className="flex-1 rounded-md border border-input bg-surface-elev px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => title.trim().length > 3 && create.mutate(title.trim())}
            disabled={create.isPending}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
          >
            {create.isPending ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <Plus className="h-3.5 w-3.5" />}
            Plan
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {campaigns.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No arcs yet. Try planning{" "}
              <span className="text-foreground">"a 6-week launch campaign"</span>.
            </p>
          </div>
        )}
        {campaigns.map((c) => {
          const arc = (c.arc ?? {}) as { weeks?: Array<{ theme?: string; posts?: unknown[] }> };
          return (
            <article key={c.id} className="rounded-lg border border-border bg-card p-4">
              <header className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-lg text-foreground">{c.title}</h3>
                <Pill size="sm" variant="ghost">
                  {arc.weeks?.length ?? 0} weeks
                </Pill>
              </header>
              {arc.weeks?.slice(0, 3).map((w, i) => (
                <div key={i} className="border-t border-border py-2 text-xs">
                  <span className="text-muted-foreground">Week {i + 1}</span>
                  <span className="mx-2 text-border">·</span>
                  <span className="text-foreground">{w.theme ?? "—"}</span>
                  <span className="mx-2 text-border">·</span>
                  <span className="text-muted-foreground">
                    {w.posts?.length ?? 0} posts
                  </span>
                </div>
              ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}
