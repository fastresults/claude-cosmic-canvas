// YouTube ingestion — resolve transcript + metadata for a video URL, then hand to ingestEntry.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ingestEntry } from "./knowledge.functions";

const IngestYouTubeInput = z.object({
  url: z.string().url(),
  domain_id: z.string().uuid().nullable().optional(),
  profile_id: z.string().uuid().nullable().optional(),
});

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

type CaptionTrack = { baseUrl: string; languageCode?: string; kind?: string; name?: { simpleText?: string } };

async function fetchTranscript(videoId: string): Promise<string> {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!watchRes.ok) throw new Error(`YouTube page fetch failed [${watchRes.status}]`);
  const html = await watchRes.text();

  // Extract the captionTracks array from ytInitialPlayerResponse.
  const match = html.match(/"captionTracks":(\[[^\]]+\])/);
  if (!match) {
    throw new Error(
      "No captions found on this video. Try one with subtitles, or upload the audio instead.",
    );
  }
  let tracks: CaptionTrack[] = [];
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    throw new Error("Could not parse caption tracks.");
  }
  // Prefer English, then any non-auto, then the first available.
  const pick =
    tracks.find((t) => t.languageCode === "en" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => t.kind !== "asr") ||
    tracks[0];
  if (!pick) throw new Error("No caption track available.");

  const capRes = await fetch(pick.baseUrl.replace(/\\u0026/g, "&"), {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!capRes.ok) throw new Error(`Caption fetch failed [${capRes.status}]`);
  const xml = await capRes.text();

  // Convert XML timedtext to plain text.
  const decoded = xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded) throw new Error("Transcript was empty.");
  return decoded;
}

async function fetchOEmbed(url: string): Promise<{ title: string; author?: string; thumbnail?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    );
    if (!res.ok) return { title: url };
    const j = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: j.title || url,
      author: j.author_name,
      thumbnail: j.thumbnail_url,
    };
  } catch {
    return { title: url };
  }
}

export const ingestYouTube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IngestYouTubeInput.parse(i))
  .handler(async ({ data }) => {
    const videoId = extractVideoId(data.url);
    if (!videoId) throw new Error("Could not read a video id from that URL.");

    const [transcript, meta] = await Promise.all([
      fetchTranscript(videoId),
      fetchOEmbed(data.url),
    ]);

    const content = `# ${meta.title}${meta.author ? `\n\n_By ${meta.author}_` : ""}\n\nSource: ${data.url}\n\n---\n\n${transcript}`;

    return ingestEntry({
      data: {
        profile_id: data.profile_id ?? null,
        domain_id: data.domain_id ?? null,
        source_type: "youtube",
        title: meta.title,
        content,
        source_url: data.url,
        tags: [],
        kind: "note",
        meta: {
          videoId,
          channel: meta.author,
          thumbnail: meta.thumbnail,
        },
      },
    });
  });
