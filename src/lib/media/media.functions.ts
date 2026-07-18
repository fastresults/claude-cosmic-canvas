// Media Hub server functions — per-user digital asset management.
// Uploads happen directly from the browser (RLS-scoped bucket); these
// functions own metadata, listing, signing, and deletion.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MEDIA_KINDS = ["image", "document", "audio", "video", "other"] as const;

const CreateInput = z.object({
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(150),
  size_bytes: z.number().int().nonnegative(),
  storage_path: z.string().trim().min(1),
  kind: z.enum(MEDIA_KINDS),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  duration_seconds: z.number().nonnegative().nullable().optional(),
  checksum: z.string().trim().max(128).nullable().optional(),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

const ListInput = z
  .object({
    q: z.string().trim().max(200).optional(),
    kind: z.enum(MEDIA_KINDS).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    limit: z.number().int().min(1).max(200).default(60),
  })
  .default({ limit: 60 });

export const listMediaAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("media_assets")
      .select(
        "id, filename, mime_type, size_bytes, storage_path, kind, title, description, tags, width, height, duration_seconds, created_at, updated_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.q) {
      const like = `%${data.q.replace(/[%_]/g, "")}%`;
      q = q.or(`title.ilike.${like},filename.ilike.${like}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("media_assets")
      .insert({
        user_id: context.userId,
        filename: data.filename,
        mime_type: data.mime_type,
        size_bytes: data.size_bytes,
        storage_path: data.storage_path,
        kind: data.kind,
        title: data.title ?? data.filename,
        description: data.description ?? null,
        tags: data.tags ?? [],
        width: data.width ?? null,
        height: data.height ?? null,
        duration_seconds: data.duration_seconds ?? null,
        checksum: data.checksum ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpdateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("media_assets")
      .update(rest)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: rErr } = await context.supabase
      .from("media_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (row?.storage_path) {
      await context.supabase.storage.from("media-hub").remove([row.storage_path]);
    }
    const { error } = await context.supabase
      .from("media_assets")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const signMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        expiresIn: z.number().int().min(30).max(60 * 60 * 24 * 365).default(300),
        download: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: rErr } = await context.supabase
      .from("media_assets")
      .select("storage_path, filename")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) throw new Error("Asset not found");
    const { data: signed, error } = await context.supabase.storage
      .from("media-hub")
      .createSignedUrl(
        row.storage_path,
        data.expiresIn,
        data.download ? { download: row.filename } : undefined,
      );
    if (error) throw error;
    return { url: signed.signedUrl };
  });


export function kindFromMime(mime: string): (typeof MEDIA_KINDS)[number] {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (
    mime === "application/pdf" ||
    mime.startsWith("application/vnd.openxmlformats") ||
    mime.startsWith("application/msword") ||
    mime.startsWith("application/vnd.ms-") ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "text/csv" ||
    mime === "application/rtf"
  )
    return "document";
  return "other";
}
