/**
 * Workspaces & Milestone Prep — server functions.
 * All handlers auth-gated. Planner + interview use the shared Anthropic
 * orchestrator. Provenance edges are written to brain_edges.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { PHASE_ORDER, type WorkspacePhase } from "./phase";

const MomentType = z.enum(["launch", "keynote", "funding", "seasonal", "pr_event", "custom"]);
const Phase = z.enum(["tease", "announce", "amplify", "sustain", "ongoing"]);
const Priority = z.enum(["low", "normal", "high"]);
const Status = z.enum(["pending", "generating", "ready", "scheduled", "published", "completed", "failed"]);

const IdInput = z.object({ id: z.string().uuid() });

// ---- List / read ---------------------------------------------------------

export const listWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ includeArchived: z.boolean().default(false) }).default({ includeArchived: false }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("opportunity_workspaces")
      .select("id, title, description, moment_type, target_date, status, total_items, completed_items, updated_at, created_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (!data.includeArchived) q = q.neq("status", "archived");
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ws, error } = await context.supabase
      .from("opportunity_workspaces")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!ws) return null;
    const { data: items, error: iErr } = await context.supabase
      .from("workspace_items")
      .select("*")
      .eq("workspace_id", ws.id)
      .order("sort_order", { ascending: true });
    if (iErr) throw iErr;
    return { workspace: ws, items: items ?? [] };
  });

// ---- Milestone interview -------------------------------------------------

export const runWorkspaceInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      moment_type: MomentType,
      target_date: z.string().optional(),
      intent: z.string().min(2),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");

    const system = [
      "You are Eve's milestone strategist. Turn a short intent into a compact JSON analysis for planning a coordinated content arc.",
      'Return ONLY JSON matching: { "summary": string, "goals": string[], "audience": string[], "key_messages": string[], "proof_points": string[], "risks": string[] }',
    ].join("\n");

    const prompt = [
      `Moment type: ${data.moment_type}`,
      data.target_date ? `Target date: ${data.target_date}` : "No target date given.",
      `Intent: ${data.intent}`,
      "",
      "Return the JSON only — no prose, no code fences.",
    ].join("\n");

    try {
      const { text } = await callAnthropic({ model: ORCHESTRATOR_MODEL, maxTokens: MAX_TOKENS, prompt, system });
      const ai_analysis = safeParseJson(text) ?? { summary: data.intent };
      return { ai_analysis };
    } catch (err) {
      return { ai_analysis: { summary: data.intent, error: err instanceof Error ? err.message : "interview failed" } };
    }
  });

// ---- Arc planner ---------------------------------------------------------

const PlanItem = z.object({
  content_type: z.string(),
  title: z.string(),
  description: z.string().default(""),
  phase: Phase.default("ongoing"),
  priority: Priority.default("normal"),
  sort_order: z.number().int().default(0),
  scheduled_offset_days: z.number().int().nullable().default(null),
  channels: z.array(z.string()).default([]),
  rationale: z.string().default(""),
});

const PlanArcInput = z.object({
  moment_type: MomentType,
  target_date: z.string().optional(),
  intent: z.string().min(2),
  ai_analysis: z.record(z.string(), z.unknown()).default({}),
  voiceId: z.string().uuid().optional(),
  knowledgeProfileId: z.string().uuid().optional(),
  presetId: z.string().uuid().optional(),
});

export const planWorkspaceArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanArcInput.parse(input))
  .handler(async ({ data }) => {
    const { CREATE_FORMATS } = await import("@/config/createFormats");
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const { CHANNELS } = await import("./strategy");

    const registry = CREATE_FORMATS.map((f) => `- ${f.id} (${f.category}): ${f.label} — ${f.description}`).join("\n");
    const channelList = CHANNELS.join(", ");

    const system = [
      "You are Eve's milestone arc strategist. Produce BOTH a strategy and a concrete phased content arc that maximizes positive press and audience impact.",
      "Phase rules: Tease T-14..T-4 · Announce T-1..T+1 · Amplify T+2..T+10 · Sustain T+11..T+30.",
      `Channels enum (pick ONLY from): ${channelList}.`,
      "Every item's content_type MUST be a Create Hub registry id below.",
      "Use the interview audience, key_messages, and proof_points to justify channels and format mix per phase.",
      'Return ONLY JSON: { "strategy": { "thesis": string, "target_outcomes": string[], "phases": { "tease"?: PhasePlan, "announce"?: PhasePlan, "amplify"?: PhasePlan, "sustain"?: PhasePlan }, "channel_strategy": [ { "channel": Channel, "role": "anchor"|"amplifier"|"proof"|"community", "audience_fit": string, "cap_per_week": number } ], "risks": string[] }, "items": [ { content_type, title, description, phase, priority, sort_order, scheduled_offset_days, channels: Channel[], rationale: string } ] }',
      "PhasePlan = { window: {start_offset, end_offset}, cadence_per_week: number, max_items: number, channels: Channel[], format_mix: [{content_type, count, why}], primary_message: string }.",
      "6–14 items total, respecting per-phase max_items.",
    ].join("\n");

    const prompt = [
      `Moment type: ${data.moment_type}`,
      data.target_date ? `Target date: ${data.target_date}` : "No fixed target date — plan phases as relative T-offsets only.",
      `Intent: ${data.intent}`,
      `Analysis: ${JSON.stringify(data.ai_analysis).slice(0, 2500)}`,
      "",
      "Create Hub registry:",
      registry,
      "",
      "Return only the JSON. No prose, no code fences.",
    ].join("\n");

    let items: z.infer<typeof PlanItem>[] = [];
    let strategy: Json | null = null;
    try {
      const { text } = await callAnthropic({ model: ORCHESTRATOR_MODEL, maxTokens: MAX_TOKENS, prompt, system });
      const parsed = safeParseJson(text);
      strategy = (parsed?.strategy as Json) ?? null;
      const raw = Array.isArray(parsed?.items) ? parsed.items : [];
      items = raw
        .map((r: unknown) => {
          const res = PlanItem.safeParse(r);
          return res.success ? res.data : null;
        })
        .filter((v): v is z.infer<typeof PlanItem> => v !== null)
        .filter((v) => CREATE_FORMATS.some((f) => f.id === v.content_type))
        .map((v) => ({
          ...v,
          channels: v.channels.filter((c) => (CHANNELS as readonly string[]).includes(c)),
        }))
        .slice(0, 14);
    } catch (err) {
      return { fallback: true as const, message: err instanceof Error ? err.message : "planner failed", items: [], strategy: null };
    }

    if (items.length === 0) {
      items = fallbackArc();
    }

    const target = data.target_date ? new Date(data.target_date) : null;
    const materialized = items.map((it, idx) => {
      const scheduled_date =
        target && it.scheduled_offset_days !== null
          ? addDays(target, it.scheduled_offset_days).toISOString()
          : null;
      return { ...it, sort_order: idx, scheduled_date };
    });

    return { fallback: false as const, items: materialized, strategy };
  });

// ---- Create workspace + items (one shot) --------------------------------

const CreateWorkspaceInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  moment_type: MomentType,
  target_date: z.string().optional(),
  ai_analysis: z.record(z.string(), z.unknown()).default({}),
  items: z.array(
    z.object({
      content_type: z.string(),
      title: z.string(),
      description: z.string().optional(),
      phase: Phase.default("ongoing"),
      priority: Priority.default("normal"),
      sort_order: z.number().int().default(0),
      scheduled_date: z.string().nullable().optional(),
    }),
  ).default([]),
});

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateWorkspaceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ws, error } = await context.supabase
      .from("opportunity_workspaces")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description ?? null,
        moment_type: data.moment_type,
        target_date: data.target_date ?? null,
        ai_analysis: (data.ai_analysis ?? {}) as Json,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;

    if (data.items.length > 0) {
      const rows = data.items.map((it, idx) => ({
        workspace_id: ws.id,
        content_type: it.content_type,
        title: it.title,
        description: it.description ?? null,
        phase: it.phase,
        priority: it.priority,
        sort_order: it.sort_order ?? idx,
        scheduled_date: it.scheduled_date ?? null,
        status: "pending" as const,
      }));
      const { error: iErr } = await context.supabase.from("workspace_items").insert(rows);
      if (iErr) throw iErr;
    }

    // Second Brain provenance.
    const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
    await writeEdgeServer(context.supabase, context.userId, {
      srcType: "you",
      srcId: context.userId,
      edgeKind: "AUTHORED_BY",
      dstType: "campaign",
      dstId: ws.id,
      meta: { kind: "workspace", moment_type: data.moment_type },
    });

    return { workspaceId: ws.id };
  });

// ---- Item ops -----------------------------------------------------------

export const addWorkspaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      workspace_id: z.string().uuid(),
      content_type: z.string(),
      title: z.string(),
      description: z.string().optional(),
      phase: Phase.default("ongoing"),
      priority: Priority.default("normal"),
      scheduled_date: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership via workspace.
    const { data: ws } = await context.supabase
      .from("opportunity_workspaces")
      .select("id")
      .eq("id", data.workspace_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!ws) throw new Error("Workspace not found");
    const { data: max } = await context.supabase
      .from("workspace_items")
      .select("sort_order")
      .eq("workspace_id", data.workspace_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (max?.sort_order ?? -1) + 1;
    const { data: row, error } = await context.supabase
      .from("workspace_items")
      .insert({
        workspace_id: data.workspace_id,
        content_type: data.content_type,
        title: data.title,
        description: data.description ?? null,
        phase: data.phase,
        priority: data.priority,
        scheduled_date: data.scheduled_date ?? null,
        sort_order: nextOrder,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { itemId: row.id };
  });

export const updateWorkspaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      phase: Phase.optional(),
      priority: Priority.optional(),
      status: Status.optional(),
      scheduled_date: z.string().nullable().optional(),
      sort_order: z.number().int().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    // RLS scopes to the user via workspace_items → workspace policy.
    const { error } = await context.supabase.from("workspace_items").update(patch).eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteWorkspaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workspace_items").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const bulkShiftWorkspaceItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspace_id: z.string().uuid(), shift_days: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("workspace_items")
      .select("id, scheduled_date")
      .eq("workspace_id", data.workspace_id);
    if (error) throw error;
    const updates = (items ?? [])
      .filter((it) => it.scheduled_date)
      .map((it) => {
        const next = addDays(new Date(it.scheduled_date as string), data.shift_days).toISOString();
        return context.supabase.from("workspace_items").update({ scheduled_date: next }).eq("id", it.id);
      });
    await Promise.all(updates);
    return { shifted: updates.length };
  });

export const archiveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("opportunity_workspaces")
      .update({ status: data.archived ? "archived" : "active" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("opportunity_workspaces")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Cohesion pass ------------------------------------------------------

export const curateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ws } = await context.supabase
      .from("opportunity_workspaces")
      .select("title, moment_type, target_date, ai_analysis")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!ws) throw new Error("Workspace not found");
    const { data: items } = await context.supabase
      .from("workspace_items")
      .select("title, phase, status, description")
      .eq("workspace_id", data.id)
      .order("sort_order", { ascending: true });
    const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
    const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
    const system = "You are Eve's editorial director. Read a milestone's items and return a short cohesion review.";
    const prompt = [
      `Milestone: ${ws.title} (${ws.moment_type}, target ${ws.target_date ?? "n/a"})`,
      `Analysis: ${JSON.stringify(ws.ai_analysis).slice(0, 1500)}`,
      "Items:",
      ...(items ?? []).map((it, i) => `${i + 1}. [${it.phase}] ${it.title} — ${it.description ?? ""}`),
      "",
      'Return JSON: { "redundancy": string[], "tone_drift": string[], "gaps": string[], "suggestions": string[] }',
    ].join("\n");
    try {
      const { text } = await callAnthropic({ model: ORCHESTRATOR_MODEL, maxTokens: MAX_TOKENS, prompt, system });
      return safeParseJson(text) ?? { suggestions: [text.slice(0, 500)] };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "curate failed" };
    }
  });

// ---- helpers ------------------------------------------------------------

function safeParseJson(text: string): Record<string, any> | null {
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try to locate the first JSON object.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function fallbackArc(): z.infer<typeof PlanItem>[] {
  const items: Array<{ content_type: string; title: string; description: string; phase: WorkspacePhase; offset: number }> = [
    { content_type: "tweet", title: "Teaser tweet", description: "Cryptic hint at what's coming.", phase: "tease", offset: -10 },
    { content_type: "linkedin-post", title: "Behind-the-scenes post", description: "Show the making of.", phase: "tease", offset: -5 },
    { content_type: "press-release", title: "Launch press release", description: "Newsroom-ready announcement.", phase: "announce", offset: 0 },
    { content_type: "linkedin-post", title: "Launch day post", description: "Personal announcement.", phase: "announce", offset: 0 },
    { content_type: "email-sequence", title: "Announcement email", description: "Send to the list.", phase: "announce", offset: 1 },
    { content_type: "case-study", title: "Amplify: proof-point case study", description: "Concrete customer story.", phase: "amplify", offset: 5 },
    { content_type: "op-ed", title: "Sustain: opinion piece", description: "POV essay to keep momentum.", phase: "sustain", offset: 14 },
  ];
  return items.map((it, i) => ({
    content_type: it.content_type,
    title: it.title,
    description: it.description,
    phase: it.phase,
    priority: "normal" as const,
    sort_order: i,
    scheduled_offset_days: it.offset,
    channels: [] as string[],
    rationale: "",
  }));
}

export { PHASE_ORDER };
