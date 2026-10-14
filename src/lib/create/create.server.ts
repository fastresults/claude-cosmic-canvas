// Server-only core for draft generation. Extracted from create.functions.ts
// so it can be shared between the client-facing `generateCreateDraft` RPC
// and the orchestrator's `draft_workspace_item` tool without going back
// through the server-function RPC boundary.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

export type GenerateDraftInput = {
  formatId: string;
  seed: string;
  draftId?: string;
  presetId?: string;
  voiceId?: string;
  briefOverrides?: Record<string, unknown>;
  workspaceId?: string | null;
  workspaceItemId?: string | null;
  channels?: string[];
  title?: string;
};

export type GenerateDraftResult =
  | { fallback: true; message: string; draftId: null }
  | {
      fallback: false;
      draftId: null;
      pendingTitle: true;
      suggestedTitle: string;
      sections: Array<{ heading: string | null; body: string }>;
    }
  | {
      fallback: false;
      draftId: string;
      pendingTitle: false;
      title: string;
      sections: Array<{ heading: string | null; body: string }>;
    };



export async function runGenerateCreateDraft(
  data: GenerateDraftInput,
  ctx: { supabase: SupabaseClient<any>; userId: string; onTextDelta?: (text: string) => void },
): Promise<GenerateDraftResult> {
  const { supabase, userId } = ctx;

  const { assertUserDefaults } = await import("@/lib/defaults/assert.server");
  await assertUserDefaults(supabase, userId);

  const { CREATE_FORMATS, normalizeCreateFormatId } = await import("@/config/createFormats");
  const formatId = normalizeCreateFormatId(data.formatId);
  const format = CREATE_FORMATS.find((f) => f.id === formatId);
  if (!format) {
    return { fallback: true, message: `Unknown format: ${data.formatId}`, draftId: null };
  }

  // Company Research uses a specialized Firecrawl + Perplexity + AI pipeline
  // instead of the generic single-prompt draft generator.
  if (format.id === "company-research") {
    return runCompanyResearchAsDraft(data, ctx);
  }


  const { formatRules } = await import("./format-rules");
  const { callAnthropic } = await import("@/lib/orchestrator/anthropic.server");
  const { ORCHESTRATOR_MODEL, MAX_TOKENS } = await import("@/lib/orchestrator/config");
  const { writeEdgeServer } = await import("@/lib/ai/provenance.server");

  const { data: profile } = await supabase
    .from("profiles")
    .select("persona_active_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const personaId: string | null = profile?.persona_active_id ?? null;
  let voiceDirectives: unknown = null;
  if (personaId) {
    const { data: voice } = await supabase
      .from("voice_profiles")
      .select("directives")
      .eq("persona_id", personaId)
      .maybeSingle();
    voiceDirectives = voice?.directives ?? null;
  }

  let workspaceBlock: string | null = null;
  if (data.workspaceId) {
    const { data: ws } = await supabase
      .from("opportunity_workspaces")
      .select("title, moment_type, target_date, ai_analysis")
      .eq("id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ws) {
      const { data: siblings } = await supabase
        .from("workspace_items")
        .select("title, phase, status")
        .eq("workspace_id", data.workspaceId)
        .neq("id", data.workspaceItemId ?? "00000000-0000-0000-0000-000000000000")
        .order("sort_order", { ascending: true })
        .limit(20);
      let selfItem: { title: string; phase: string; description: string | null } | null = null;
      if (data.workspaceItemId) {
        const { data: item } = await supabase
          .from("workspace_items")
          .select("title, phase, description")
          .eq("id", data.workspaceItemId)
          .maybeSingle();
        selfItem = item ?? null;
      }
      const target = ws.target_date ? new Date(ws.target_date) : null;
      const today = new Date();
      const tOffset = target
        ? Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const tLabel = tOffset === null ? "n/a" : tOffset === 0 ? "T" : tOffset > 0 ? `T+${tOffset}` : `T${tOffset}`;
      const analysis = (ws.ai_analysis ?? {}) as Record<string, unknown>;
      const summary = typeof analysis.summary === "string" ? analysis.summary : JSON.stringify(analysis).slice(0, 400);
      const siblingList = (siblings ?? [])
        .map((s) => `- [${s.phase}] ${s.title}${s.status ? ` (${s.status})` : ""}`)
        .join("\n");
      workspaceBlock = [
        `[WORKSPACE_CONTEXT]`,
        `Milestone: ${ws.title}`,
        `Moment type: ${ws.moment_type}`,
        `Target date: ${ws.target_date ?? "n/a"} (${tLabel})`,
        `Arc phase for this piece: ${selfItem?.phase ?? "ongoing"}`,
        `Arc summary: ${summary}`,
        `Sibling items already scoped:\n${siblingList || "- (none yet)"}`,
        `This piece's role in the arc: ${selfItem?.description ?? selfItem?.title ?? "supporting piece"}`,
        `Reference sibling pieces where useful — do NOT duplicate them.`,
      ].join("\n");
    }
  }

  const blocks: string[] = [];
  blocks.push(`[DOMAIN]\n${personaId ? "Active persona in use." : "General."}`);
  blocks.push(
    voiceDirectives
      ? `[VOICE]\n${JSON.stringify(voiceDirectives).slice(0, 2000)}`
      : `[VOICE]\nWrite as ${profile?.display_name ?? "the user"}; match their cadence.`,
  );
  blocks.push(`[KNOWLEDGE]\n(No matching reference material was pre-fetched for this call.)`);
  const { normalizeSocialChannels } = await import("./channel-rules");
  const channels = format.id === "post-content" ? normalizeSocialChannels(data.channels ?? []) : [];
  const briefSnapshot: Record<string, unknown> = { ...(data.briefOverrides ?? {}) };
  if (channels.length) briefSnapshot.channels = channels;
  blocks.push(`[PRESET]\n${JSON.stringify(briefSnapshot)}`);
  if (workspaceBlock) blocks.push(workspaceBlock);
  blocks.push(`[FORMAT_RULES]\n${formatRules(format, { channels })}`);
  blocks.push(`[TASK]\n${data.seed}`);

  const system = [
    "You are Eve, an on-brand ghostwriter.",
    "Ground every factual claim in [KNOWLEDGE]. If a claim cannot be supported, omit it. Never fabricate roles, companies, dates, or numbers.",
    "Priority when signals conflict: Topic > Domain > Voice > Knowledge.",
  ].join("\n");

  let bodyText = "";
  let usage: unknown = null;
  try {
    const result = await callAnthropic({
      model: ORCHESTRATOR_MODEL,
      maxTokens: MAX_TOKENS,
      prompt: blocks.join("\n\n"),
      system,
      onTextDelta: ctx.onTextDelta,
    });
    bodyText = result.text.trim();
    usage = result.usage;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return { fallback: true, message, draftId: null };
  }

  let sections: Array<{ heading: string | null; body: string }>;
  if (format.id === "post-content" && channels.length > 0) {
    const { splitChannelSections } = await import("./channel-rules");
    sections = splitChannelSections(bodyText, channels);
  } else {
    sections = splitSections(bodyText, format.id);
  }
  const suggestedTitle = deriveTitle(bodyText, data.seed);

  if (!data.draftId && !data.title) {
    return {
      fallback: false,
      draftId: null,
      pendingTitle: true,
      suggestedTitle,
      sections,
    };
  }

  const basePayload = {
    user_id: userId,
    format_id: format.id,
    sections: sections as unknown as Json,
    brief_snapshot: (Object.keys(briefSnapshot).length ? briefSnapshot : null) as Json | null,
    preset_id: data.presetId ?? null,
    voice_id: data.voiceId ?? null,
    status: "draft" as const,
    workspace_id: data.workspaceId ?? null,
    workspace_item_id: data.workspaceItemId ?? null,
  };

  let draftId = data.draftId ?? null;
  let finalTitle: string;
  if (draftId) {
    const updatePayload = data.title ? { ...basePayload, title: data.title } : basePayload;
    const { data: row, error } = await supabase
      .from("create_drafts")
      .update(updatePayload)
      .eq("id", draftId)
      .eq("user_id", userId)
      .select("title")
      .single();
    if (error) throw error;
    finalTitle = row.title;
  } else {
    const insertPayload = { ...basePayload, title: data.title! };
    const { data: row, error } = await supabase
      .from("create_drafts")
      .insert(insertPayload)
      .select("id, title")
      .single();
    if (error) throw error;
    draftId = row.id;
    finalTitle = row.title;
  }

  if (draftId) {
    await writeEdgeServer(supabase, userId, {
      srcType: "you",
      srcId: userId,
      edgeKind: "GENERATED_BY_TOOL",
      dstType: "draft",
      dstId: draftId,
      meta: {
        tool: "claude",
        model: ORCHESTRATOR_MODEL,
        format: format.id,
        seed: data.seed.slice(0, 500),
        usage,
        workspace_id: data.workspaceId ?? null,
        workspace_item_id: data.workspaceItemId ?? null,
      },
    });

    if (data.workspaceItemId) {
      await supabase
        .from("workspace_items")
        .update({ status: "ready", content_generation_id: draftId })
        .eq("id", data.workspaceItemId);
    }

    if (format.id === "post-content" && channels.length === 1) {
      await supabase
        .from("profiles")
        .update({ last_social_channel: channels[0] })
        .eq("user_id", userId);
    }
  }

  return {
    fallback: false,
    draftId: draftId!,
    pendingTitle: false,
    title: finalTitle,
    sections,
  };
}

function splitSections(body: string, formatId: string): Array<{ heading: string | null; body: string }> {
  const sep = formatId === "email-sequence" ? /---EMAIL---/i
    : formatId === "newsletter-sequence" ? /---ISSUE---/i
    : null;
  if (sep) {
    return body
      .split(sep)
      .map((s, i) => ({ heading: `Part ${i + 1}`, body: s.trim() }))
      .filter((s) => s.body.length > 0);
  }
  const parts = body.split(/^\s*#{1,2}\s+/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [{ heading: null, body: body.trim() }];
  return parts.map((p) => {
    const [firstLine, ...rest] = p.split("\n");
    return { heading: firstLine.trim(), body: rest.join("\n").trim() };
  });
}

function deriveTitle(body: string, seed: string): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  const stripped = firstLine.replace(/^#+\s*/, "").replace(/^["'*]+|["'*]+$/g, "");
  if (stripped.length > 0 && stripped.length <= 120) return stripped;
  return seed.slice(0, 80);
}

/**
 * Parse a free-form research seed into a `{ companyName, companyUrl }` pair.
 * Extracts the first domain-like token from the seed as the URL; everything
 * else (with the domain removed) becomes the company name.
 */
function parseResearchSeed(seed: string): { companyName: string; companyUrl: string } | null {
  const raw = seed.trim();
  if (!raw) return null;
  const domainRegex = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?/i;
  const match = raw.match(domainRegex);
  if (!match) {
    // No URL — treat the whole seed as the company name and guess a domain.
    return { companyName: raw, companyUrl: "" };
  }
  const url = match[0];
  const nameCandidate = raw.replace(url, "").replace(/[,;|]+/g, " ").replace(/\s+/g, " ").trim();
  const cleaned = nameCandidate.replace(/^(search|research|find|look\s*up|about)\s+/i, "").trim();
  const companyName = cleaned || url.replace(/^https?:\/\//, "").split("/")[0];
  return { companyName, companyUrl: url };
}

async function runCompanyResearchAsDraft(
  data: GenerateDraftInput,
  ctx: { supabase: SupabaseClient<any>; userId: string },
): Promise<GenerateDraftResult> {
  const { supabase, userId } = ctx;

  const parsed = parseResearchSeed(data.seed);
  if (!parsed || (!parsed.companyUrl && !parsed.companyName)) {
    return {
      fallback: true,
      draftId: null,
      message: "Please include a company name and website (e.g. 'Smoke Rise Country Club smokerisecc.com').",
    };
  }
  if (!parsed.companyUrl) {
    return {
      fallback: true,
      draftId: null,
      message: `Please include a website URL for "${parsed.companyName}" (e.g. companyname.com) so we can research it.`,
    };
  }

  const { runCompanyResearchCore, dossierToSections } = await import(
    "@/lib/research/company-research.server"
  );

  let researchResult;
  try {
    researchResult = await runCompanyResearchCore({
      companyName: parsed.companyName,
      companyUrl: parsed.companyUrl,
      additionalContext: "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Company research failed";
    return { fallback: true, draftId: null, message };
  }

  const sections = dossierToSections(researchResult.dossier);
  if (researchResult.missingSources.length > 0) {
    sections.unshift({
      heading: "Partial research",
      body: `Some sources were unavailable (${researchResult.missingSources.join(" and ")}), so this dossier may be incomplete. Try again later for a fuller picture.`,
    });
  }
  const suggestedTitle = `${researchResult.dossier.company?.name ?? parsed.companyName} — Corporate Research`;

  if (!data.draftId && !data.title) {
    return {
      fallback: false,
      draftId: null,
      pendingTitle: true,
      suggestedTitle,
      sections,
    };
  }

  const briefSnapshot = {
    format_id: "company-research",
    seed: data.seed.slice(0, 500),
    company_name: parsed.companyName,
    company_url: parsed.companyUrl,
    dossier: researchResult.dossier,
    pages_scraped: researchResult.pagesScraped,
    urls_selected: researchResult.urlsSelected,
    processing_time_ms: researchResult.processingTimeMs,
    external_intel_used: researchResult.externalIntelUsed,
  };

  const basePayload = {
    user_id: userId,
    format_id: "company-research" as const,
    sections: sections as unknown as Json,
    brief_snapshot: briefSnapshot as unknown as Json,
    preset_id: data.presetId ?? null,
    voice_id: data.voiceId ?? null,
    status: "draft" as const,
    workspace_id: data.workspaceId ?? null,
    workspace_item_id: data.workspaceItemId ?? null,
  };

  let draftId = data.draftId ?? null;
  let finalTitle: string;
  if (draftId) {
    const updatePayload = data.title ? { ...basePayload, title: data.title } : basePayload;
    const { data: row, error } = await supabase
      .from("create_drafts")
      .update(updatePayload)
      .eq("id", draftId)
      .eq("user_id", userId)
      .select("title")
      .single();
    if (error) throw error;
    finalTitle = row.title;
  } else {
    const insertPayload = { ...basePayload, title: data.title! };
    const { data: row, error } = await supabase
      .from("create_drafts")
      .insert(insertPayload)
      .select("id, title")
      .single();
    if (error) throw error;
    draftId = row.id;
    finalTitle = row.title;
  }

  const { writeEdgeServer } = await import("@/lib/ai/provenance.server");
  if (draftId) {
    await writeEdgeServer(supabase, userId, {
      srcType: "you",
      srcId: userId,
      edgeKind: "GENERATED_BY_TOOL",
      dstType: "draft",
      dstId: draftId,
      meta: {
        tool: "company-research",
        format: "company-research",
        seed: data.seed.slice(0, 500),
        pages_scraped: researchResult.pagesScraped,
        processing_time_ms: researchResult.processingTimeMs,
      },
    });
  }

  return {
    fallback: false,
    draftId: draftId!,
    pendingTitle: false,
    title: finalTitle,
    sections,
  };
}

