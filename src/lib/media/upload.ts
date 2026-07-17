// Browser upload helper for the Media Hub. Uploads to the RLS-scoped
// media-hub bucket, extracts optional dimensions/duration, then persists
// metadata via the createMediaAsset server function.
import { supabase } from "@/integrations/supabase/client";
import { createMediaAsset, kindFromMime } from "@/lib/media/media.functions";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "file";
}

async function probeImage(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

async function probeDuration(file: File, kind: "audio" | "video"): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(kind === "audio" ? "audio" : "video") as HTMLMediaElement;
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(el.duration) ? el.duration : undefined);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    el.src = url;
  });
}

export async function uploadMediaFile(file: File) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload media.");

  const assetId = crypto.randomUUID();
  const path = `${user.id}/${assetId}/${safeName(file.name)}`;

  const { error: upErr } = await supabase.storage.from("media-hub").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const kind = kindFromMime(file.type || "application/octet-stream");
  const meta: {
    width?: number;
    height?: number;
    duration_seconds?: number;
  } = {};
  if (kind === "image") Object.assign(meta, await probeImage(file));
  else if (kind === "audio" || kind === "video")
    meta.duration_seconds = await probeDuration(file, kind);

  return await createMediaAsset({
    data: {
      filename: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: path,
      kind,
      title: file.name,
      tags: [],
      width: meta.width ?? null,
      height: meta.height ?? null,
      duration_seconds: meta.duration_seconds ?? null,
    },
  });
}
