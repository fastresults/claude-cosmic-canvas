import type { Tables } from "@/integrations/supabase/types";
export type KnowledgeEntry = Tables<"knowledge_entries">;
export type KnowledgeProfile = Tables<"knowledge_profiles">;
export type KnowledgeJob = Tables<"knowledge_ingestion_jobs">;

export const SOURCE_LABELS: Record<string, string> = {
  paste: "Note",
  url: "URL",
  upload: "File",
  audio: "Audio",
  voice_memo: "Voice memo",
  linkedin: "LinkedIn",
  resume: "Résumé",
  youtube: "YouTube",
  research: "AI research",
};

export const KIND_LABELS: Record<string, string> = {
  personal: "Personal",
  client: "Client",
  campaign: "Campaign",
};

const ACTIVE_PROFILE_KEY = "kb.activeProfileId";

export function loadActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
