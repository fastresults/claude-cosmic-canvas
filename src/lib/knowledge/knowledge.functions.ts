// Knowledge Base — profiles, entries, ingest, embed, and semantic search.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { EMBED_MODEL, chunkText } from "./embedding";
import type { KnowledgeHit } from "./grounded-prompt";

// ---------- Profiles ----------

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_profiles")
      .select("id, name, kind, parent_profile_id, is_default, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    // Ensure at least one Personal profile exists.
    if (!data || data.length === 0) {
      const { data: seeded, error: seedErr } = await context.supabase
        .from("knowledge_profiles")
        .insert({ user_id: context.userId, name: "Personal", kind: "personal", is_default: true })
        .select("id, name, kind, parent_profile_id, is_default, created_at")
        .single();
      if (seedErr) throw seedErr;
      return [seeded];
    }
    return data;
  });

export const setDefaultKnowledgeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Unset any existing default for this user, then set this one.
    await context.supabase
      .from("knowledge_profiles")
      .update({ is_default: false })
      .eq("user_id", context.userId)
      .eq("is_default", true);
    const { error } = await context.supabase
      .from("knowledge_profiles")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const CreateProfileInput = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["personal", "client", "campaign"]),
  parent_profile_id: z.string().uuid().nullable().optional(),
});

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateProfileInput.parse(i))
  .handler(async ({ data, context }) => {
    // If the user has no default knowledge profile yet, this new one becomes it.
    const { data: existingDefault } = await context.supabase
      .from("knowledge_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("is_default", true)
      .maybeSingle();
    const shouldBeDefault = !existingDefault;

    const { data: row, error } = await context.supabase
      .from("knowledge_profiles")
      .insert({
        user_id: context.userId,
        name: data.name,
        kind: data.kind,
        parent_profile_id: data.parent_profile_id ?? null,
        is_default: shouldBeDefault,
      })
      .select("id, name, kind, parent_profile_id, is_default, created_at")
      .single();
    if (error) throw error;
    return row;
  });

// Resolve the inheritance chain: [profile, parent, grandparent, ...]
type SupabaseAny = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        a: string,
        b: string,
      ) => {
        eq: (
          a: string,
          b: string,
        ) => { maybeSingle: () => Promise<{ data: { parent_profile_id: string | null } | null }> };
      };
    };
  };
};

async function resolveProfileChain(
  supabase: SupabaseAny,
  userId: string,
  profileId: string | null,
): Promise<string[]> {
  if (!profileId) return [];
  const chain: string[] = [];
  let currentId: string | null = profileId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId) && chain.length < 5) {
    seen.add(currentId);
    chain.push(currentId);
    const { data } = await supabase
      .from("knowledge_profiles")
      .select("parent_profile_id")
      .eq("id", currentId)
      .eq("user_id", userId)
      .maybeSingle();
    currentId = data?.parent_profile_id ?? null;
  }
  return chain;
}

// ---------- Entries ----------

export const listEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        profile_id: z.string().uuid().nullable().optional(),
        // Omitted = all. Explicit null = CV only (no domain). UUID = that domain only.
        domain_id: z.string().uuid().nullable().optional(),
        include_archived: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("knowledge_entries")
      .select(
        "id, title, kind, source_type, source_url, tags, pinned, archived_at, use_in_next_gen, meta, content, profile_id, domain_id, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (!data.include_archived) query = query.is("archived_at", null);
    if (data.profile_id) query = query.eq("profile_id", data.profile_id);
    if (data.domain_id === null) query = query.is("domain_id", null);
    else if (typeof data.domain_id === "string") query = query.eq("domain_id", data.domain_id);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });

export const countEntriesByDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_entries")
      .select("domain_id")
      .eq("user_id", context.userId)
      .is("archived_at", null)
      .not("domain_id", "is", null);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const r of data ?? []) {
      if (r.domain_id) counts[r.domain_id] = (counts[r.domain_id] ?? 0) + 1;
    }
    return counts;
  });

export const pinEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_entries")
      .update({ pinned: data.pinned })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const archiveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("knowledge_entries")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;

    // Keep the Brain graph in sync with archive state.
    try {
      if (data.archived) {
        await context.supabase
          .from("brain_edges")
          .delete()
          .eq("user_id", context.userId)
          .eq("dst_type", "knowledge")
          .eq("dst_id", data.id);
      } else {
        const { data: entry } = await context.supabase
          .from("knowledge_entries")
          .select("title, source_type, kind")
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .maybeSingle();
        await context.supabase.from("brain_edges").insert({
          user_id: context.userId,
          src_type: "you",
          src_id: context.userId,
          edge_kind: "SOURCED_FROM",
          dst_type: "knowledge",
          dst_id: data.id,
          meta: {
            source_type: entry?.source_type,
            title: entry?.title,
            kind: entry?.kind,
          } as Json,
        });
      }
    } catch (e) {
      console.error("[knowledge] brain edge sync on archive failed", e);
    }

    return { ok: true };
  });

export const updateEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        tags: z.array(z.string().max(40)).max(30).optional(),
        use_in_next_gen: z.boolean().optional(),
        content: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      title?: string;
      tags?: string[];
      use_in_next_gen?: boolean;
      content?: string;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.use_in_next_gen !== undefined) patch.use_in_next_gen = data.use_in_next_gen;
    if (data.content !== undefined) patch.content = data.content;
    const { error } = await context.supabase
      .from("knowledge_entries")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Ingest ----------

const IngestInput = z.object({
  profile_id: z.string().uuid().nullable().optional(),
  domain_id: z.string().uuid().nullable().optional(),
  source_type: z.enum(["paste", "url", "upload", "audio", "voice_memo", "linkedin", "resume"]),
  title: z.string().max(200).nullable().optional(),
  content: z.string().min(1),
  source_url: z.string().url().nullable().optional(),
  tags: z.array(z.string().max(40)).max(30).default([]),
  meta: z.record(z.string(), z.unknown()).default({}),
  kind: z.string().default("note"),
});

export const ingestEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IngestInput.parse(i))
  .handler(async ({ data, context }) => {
    const title =
      data.title?.trim() ||
      data.content.split("\n").find((l) => l.trim())?.slice(0, 100) ||
      "Untitled";

    const { data: entry, error: entryErr } = await context.supabase
      .from("knowledge_entries")
      .insert({
        user_id: context.userId,
        profile_id: data.profile_id ?? null,
        domain_id: data.domain_id ?? null,
        title,
        content: data.content,
        source_type: data.source_type,
        source_url: data.source_url ?? null,
        tags: data.tags,
        kind: data.kind,
        meta: data.meta as Json,
      })
      .select("id")
      .single();
    if (entryErr) throw entryErr;

    const { data: job, error: jobErr } = await context.supabase
      .from("knowledge_ingestion_jobs")
      .insert({
        user_id: context.userId,
        entry_id: entry.id,
        status: "embedding",
        stage_message: "Chunking and embedding…",
      })
      .select("id")
      .single();
    if (jobErr) throw jobErr;

    // Fire-and-await embedding inline (Workers have no background jobs).
    try {
      await embedEntryInternal(context.supabase, context.userId, entry.id, data.content);
      await context.supabase
        .from("knowledge_ingestion_jobs")
        .update({ status: "done", stage_message: "Ready" })
        .eq("id", job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase
        .from("knowledge_ingestion_jobs")
        .update({ status: "error", error: msg })
        .eq("id", job.id);
      throw e;
    }

    // Wire the new entry into the Brain graph as `you → SOURCED_FROM → knowledge:<id>`,
    // plus `domain → SOURCED_FROM → knowledge:<id>` when scoped to a domain.
    // Non-fatal: log and continue if this fails.
    try {
      type EdgeRow = {
        user_id: string;
        src_type: "you" | "domain";
        src_id: string;
        edge_kind: "SOURCED_FROM";
        dst_type: "knowledge";
        dst_id: string;
        meta: Json;
      };
      const edges: EdgeRow[] = [
        {
          user_id: context.userId,
          src_type: "you",
          src_id: context.userId,
          edge_kind: "SOURCED_FROM",
          dst_type: "knowledge",
          dst_id: entry.id,
          meta: { source_type: data.source_type, title, kind: data.kind } as Json,
        },
      ];
      if (data.domain_id) {
        edges.push({
          user_id: context.userId,
          src_type: "domain" as const,
          src_id: data.domain_id,
          edge_kind: "SOURCED_FROM" as const,
          dst_type: "knowledge" as const,
          dst_id: entry.id,
          meta: { source_type: data.source_type, title, kind: data.kind } as Json,
        });
      }
      await context.supabase.from("brain_edges").insert(edges);
    } catch (e) {
      console.error("[knowledge] brain edge insert failed", e);
    }

    return { entryId: entry.id, jobId: job.id };
  });

// ---------- Embedding ----------

async function embedEntryInternal(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  userId: string,
  entryId: string,
  content: string,
) {
  const chunks = chunkText(content);
  if (chunks.length === 0) return;

  const { gatewayFetch } = await import("@/lib/ai/gateway.server");
  // Embed in batches of 96 (well under provider caps).
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 96) {
    const batch = chunks.slice(i, i + 96);
    const res = await gatewayFetch("/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch, dimensions: 1536 }),
    });
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    for (const d of json.data) embeddings.push(d.embedding);
  }

  // Remove any prior chunks for this entry (idempotent re-embed).
  await supabase.from("knowledge_chunks").delete().eq("entry_id", entryId);

  const rows = chunks.map((c, idx) => ({
    entry_id: entryId,
    user_id: userId,
    chunk_index: idx,
    content: c,
    embedding: embeddings[idx] as unknown as string,
  }));
  const { error: insErr } = await supabase.from("knowledge_chunks").insert(rows);
  if (insErr) throw insErr;

  // Store summary vector = first chunk's embedding.
  await supabase
    .from("knowledge_entries")
    .update({ embedding: embeddings[0] as unknown as string })
    .eq("id", entryId);
}

// ---------- Search ----------

export const searchKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        query: z.string().min(1),
        profile_id: z.string().uuid().nullable().optional(),
        k: z.number().int().min(1).max(20).default(8),
        tags: z.array(z.string()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<KnowledgeHit[]> => {
    const chain = await resolveProfileChain(
      context.supabase as never,
      context.userId,
      data.profile_id ?? null,
    );

    const { gatewayFetch } = await import("@/lib/ai/gateway.server");
    const embRes = await gatewayFetch("/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: data.query, dimensions: 1536 }),
    });
    const embJson = (await embRes.json()) as { data: Array<{ embedding: number[] }> };
    const queryVec = embJson.data[0]?.embedding;
    if (!queryVec) return [];

    const { data: hits, error } = await context.supabase.rpc("match_knowledge_chunks", {
      p_user_id: context.userId,
      p_profile_ids: (chain.length ? chain : null) as unknown as string[],
      p_query: queryVec as unknown as string,
      p_match_count: data.k,
      p_tag_filter: (data.tags && data.tags.length ? data.tags : null) as unknown as string[],
    });
    if (error) throw error;
    return (hits ?? []).map((h) => ({
      chunkId: h.chunk_id,
      entryId: h.entry_id,
      entryTitle: h.entry_title,
      sourceType: h.source_type,
      content: h.content,
    }));
  });
